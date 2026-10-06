/** YAS LAB Cryogenic Sample Inventory - Google Apps Script backend. */
const CONFIG = {
  SPREADSHEET_ID: 'REPLACE_WITH_GOOGLE_SHEET_ID',
  TIMEZONE: 'Asia/Taipei',
  SHEETS: { SAMPLES: 'Samples', STORAGE: 'Storage', BOXES: 'Boxes', ACTIVITY: 'Activity_Log' }
};

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'inventory';
    if (action === 'inventory') return jsonResponse(getInventory());
    if (action === 'health') return jsonResponse({ ok: true, service: 'cryogenic-sample-inventory' });
    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) { return jsonResponse({ error: error.message }, 500); }
}

function doPost(e) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const payload = JSON.parse(e.postData.contents || '{}');
    if (payload.action === 'create') return jsonResponse(createSample(payload.sample));
    if (payload.action === 'update') return jsonResponse(updateSample(payload.sample));
    if (payload.action === 'move') return jsonResponse(moveSample(payload.sampleId, payload.toLocationId));
    return jsonResponse({ error: 'Unknown action' }, 400);
  } catch (error) { return jsonResponse({ error: error.message }, 500); }
  finally { lock.releaseLock(); }
}


function seedDemoData() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    setupSheets();
    const samplesSheet = getSheet(CONFIG.SHEETS.SAMPLES);
    const storageSheet = getSheet(CONFIG.SHEETS.STORAGE);
    const boxesSheet = getSheet(CONFIG.SHEETS.BOXES);

    if (samplesSheet.getLastRow() > 1 || storageSheet.getLastRow() > 1 || boxesSheet.getLastRow() > 1) {
      throw new Error('Demo data was not inserted because inventory data already exists. Clear the test tabs first if you want a clean demo dataset.');
    }

    boxesSheet.getRange(2, 1, 3, 6).setValues([
      ['S1-B01', 'S1', 'B01', 'Box 01', 9, 'A,B,C,D,E,F,G,H,I'],
      ['S1-B02', 'S1', 'B02', 'Box 02', 9, 'A,B,C,D,E,F,G,H,I'],
      ['S2-B01', 'S2', 'B01', 'Box 01', 9, 'A,B,C,D,E,F,G,H,I']
    ]);

    const now = nowString();
    samplesSheet.getRange(2, 1, 3, 10).setValues([
      ['YAS-001', 'HEK293T', 'Cell line', 12, 5, 'Passed', 'YAS', 'Working stock', now, now],
      ['YAS-002', 'HeLa', 'Cell line', 8, 4, 'Pending', 'Alex', 'Awaiting QC', now, now],
      ['YAS-003', 'CHO-K1', 'Cell line', 6, 3, 'Passed', 'YAS', 'Backup stock', now, now]
    ]);

    storageSheet.getRange(2, 1, 3, 6).setValues([
      [Utilities.getUuid(), 'YAS-001', 'S1', 'B01', 'C3', now],
      [Utilities.getUuid(), 'YAS-002', 'S1', 'B01', 'F6', now],
      [Utilities.getUuid(), 'YAS-003', 'S1', 'B02', 'A1', now]
    ]);

    logActivity('SEED', 'YAS-001', '', 'S1-B01-C3', 'SYSTEM', 'Inserted demo inventory');
    logActivity('SEED', 'YAS-002', '', 'S1-B01-F6', 'SYSTEM', 'Inserted demo inventory');
    logActivity('SEED', 'YAS-003', '', 'S1-B02-A1', 'SYSTEM', 'Inserted demo inventory');

    return getInventory();
  } finally {
    lock.releaseLock();
  }
}

function setupSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  ensureSheet(ss, CONFIG.SHEETS.SAMPLES, ['sample_id','cell_line','sample_type','passage','cell_count','qc_status','owner','notes','created_at','updated_at']);
  ensureSheet(ss, CONFIG.SHEETS.STORAGE, ['storage_id','sample_id','stripe','box','position','updated_at']);
  ensureSheet(ss, CONFIG.SHEETS.BOXES, ['box_id','stripe','box_number','name','rows','columns']);
  ensureSheet(ss, CONFIG.SHEETS.ACTIVITY, ['timestamp','action','sample_id','from_location','to_location','user','details']);
}
function ensureSheet(ss, name, headers) {
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
  if (sheet.getLastRow() === 0) { sheet.getRange(1,1,1,headers.length).setValues([headers]); sheet.setFrozenRows(1); }
}

function getInventory() { return { samples: readSamples(), boxes: readBoxes() }; }

function readSamples() {
  const rows = readObjectsRaw(CONFIG.SHEETS.SAMPLES);
  return rows.map(function(row) {
    const storage = findStorageBySampleId(String(row.sample_id));
    return { id:String(row.sample_id), cellLine:String(row.cell_line || ''), sampleType:String(row.sample_type || ''), passage:row.passage === '' ? undefined : Number(row.passage), cellCount:row.cell_count === '' ? undefined : Number(row.cell_count), qcStatus:String(row.qc_status || 'Pending'), owner:String(row.owner || ''), locationId:storage ? storage.stripe + '-' + storage.box + '-' + storage.position : '', notes:String(row.notes || ''), createdAt:formatDate(row.created_at), updatedAt:formatDate(row.updated_at) };
  });
}
function readBoxes() {
  return readObjectsRaw(CONFIG.SHEETS.BOXES).map(function(row) { return { id:String(row.box_id), stripeId:String(row.stripe), name:String(row.name), rows:Number(row.rows)||9, columns:String(row.columns || 'A,B,C,D,E,F,G,H,I').split(',') }; });
}
function readObjectsRaw(sheetName) {
  const sheet = getSheet(sheetName); const values = sheet.getDataRange().getValues(); if (values.length < 2) return [];
  const headers = values[0]; return values.slice(1).filter(function(row){ return row.some(function(v){return v !== '';}); }).map(function(row){ const item={}; headers.forEach(function(h,i){item[h]=row[i];}); return item; });
}

function createSample(sample) {
  validateSample(sample); if (findRow(CONFIG.SHEETS.SAMPLES, sample.id)) throw new Error('Sample ID already exists: ' + sample.id);
  ensureLocationAvailable(sample.locationId); const loc=parseLocation(sample.locationId); const now=nowString();
  getSheet(CONFIG.SHEETS.SAMPLES).appendRow([sample.id,sample.cellLine||'',sample.sampleType||'',sample.passage ?? '',sample.cellCount ?? '',sample.qcStatus||'Pending',sample.owner||'',sample.notes||'',now,now]);
  getSheet(CONFIG.SHEETS.STORAGE).appendRow([Utilities.getUuid(),sample.id,loc.stripe,loc.box,loc.position,now]);
  logActivity('CREATE',sample.id,'',sample.locationId,'','Created sample'); return getSampleById(sample.id);
}
function updateSample(sample) {
  validateSample(sample); const found=findRow(CONFIG.SHEETS.SAMPLES,sample.id); if(!found) throw new Error('Sample not found: '+sample.id); const now=nowString();
  getSheet(CONFIG.SHEETS.SAMPLES).getRange(found.row,1,1,10).setValues([[sample.id,sample.cellLine||'',sample.sampleType||'',sample.passage ?? '',sample.cellCount ?? '',sample.qcStatus||'Pending',sample.owner||'',sample.notes||'',sample.createdAt||now,now]]);
  logActivity('UPDATE',sample.id,sample.locationId||'',sample.locationId||'','','Updated sample'); return getSampleById(sample.id);
}
function moveSample(sampleId,toLocationId) {
  if(!sampleId||!toLocationId) throw new Error('sampleId and toLocationId are required'); const sample=getSampleById(sampleId); if(!sample) throw new Error('Sample not found: '+sampleId); ensureLocationAvailable(toLocationId);
  const found=findStorageRow(sampleId); if(!found) throw new Error('Storage record not found: '+sampleId); const loc=parseLocation(toLocationId); const previous=sample.locationId;
  getSheet(CONFIG.SHEETS.STORAGE).getRange(found.row,3,1,4).setValues([[loc.stripe,loc.box,loc.position,nowString()]]); logActivity('MOVE',sampleId,previous,toLocationId,'','Moved sample'); return getSampleById(sampleId);
}
function validateSample(sample){ if(!sample||!sample.id) throw new Error('sample.id is required'); if(!sample.cellLine) throw new Error('cellLine is required'); if(!sample.locationId) throw new Error('locationId is required'); }
function ensureLocationAvailable(locationId){ const loc=parseLocation(locationId); const rows=readObjectsRaw(CONFIG.SHEETS.STORAGE); const occupied=rows.some(function(r){return String(r.stripe)===loc.stripe&&String(r.box)===loc.box&&String(r.position)===loc.position;}); if(occupied) throw new Error('Storage position is already occupied: '+locationId); }
function parseLocation(locationId){ const m=String(locationId).match(/^(S[^-]+)-(B[^-]+)-([A-I][1-9])$/); if(!m) throw new Error('Invalid location ID: '+locationId); return {stripe:m[1],box:m[2],position:m[3]}; }
function findRow(sheetName,value){ const sheet=getSheet(sheetName); if(sheet.getLastRow()<2)return null; const values=sheet.getRange(2,1,sheet.getLastRow()-1,1).getValues(); for(let i=0;i<values.length;i++) if(String(values[i][0])===String(value)) return {row:i+2}; return null; }
function findStorageRow(sampleId){ const sheet=getSheet(CONFIG.SHEETS.STORAGE); if(sheet.getLastRow()<2)return null; const values=sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues(); for(let i=0;i<values.length;i++) if(String(values[i][1])===String(sampleId)) return {row:i+2}; return null; }
function findStorageBySampleId(sampleId){ const found=findStorageRow(sampleId); if(!found)return null; const sheet=getSheet(CONFIG.SHEETS.STORAGE); return {stripe:sheet.getRange(found.row,3).getValue(),box:sheet.getRange(found.row,4).getValue(),position:sheet.getRange(found.row,5).getValue()}; }
function getSampleById(sampleId){ const rows=readSamples(); return rows.find(function(s){return String(s.id)===String(sampleId)}) || null; }
function logActivity(action,sampleId,fromLocation,toLocation,user,details){ getSheet(CONFIG.SHEETS.ACTIVITY).appendRow([nowString(),action,sampleId,fromLocation,toLocation,user,details]); }
function getSheet(name){ const sheet=SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName(name); if(!sheet) throw new Error('Sheet not found. Run setupSheets() first: '+name); return sheet; }
function nowString(){ return Utilities.formatDate(new Date(),CONFIG.TIMEZONE,'yyyy-MM-dd HH:mm:ss'); }
function formatDate(value){ if(!value)return ''; if(value instanceof Date)return Utilities.formatDate(value,CONFIG.TIMEZONE,"yyyy-MM-dd'T'HH:mm:ss"); return String(value); }
function jsonResponse(data,status){ return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON); }
