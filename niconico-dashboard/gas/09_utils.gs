/**
 * ============================================================
 * 09_utils.gs - 共通ユーティリティ関数
 * ============================================================
 */

/**
 * 昨日の日付を 'yyyy-MM-dd' 形式で取得
 */
function getYesterdayDate_() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * N日前の日付を 'yyyy-MM-dd' 形式で取得
 */
function getDateNDaysAgo_(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

/**
 * 指定日のデータが既に記録されているかチェック
 */
function isDateAlreadyRecorded_(sheet, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    const formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) return true;
  }
  return false;
}

/**
 * 指定日の行番号を見つけるか、新規行を作成
 */
function findOrCreateRow_(sheet, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    const formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) return i + 1; // 1-indexed
  }
  // 見つからない場合は新規行を作成
  const newRow = sheet.getLastRow() + 1;
  sheet.getRange(newRow, 1).setValue(date);
  return newRow;
}

/**
 * 指定日の既存行を削除
 */
function removeExistingRows_(sheet, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = data.length - 1; i >= 1; i--) {
    const rowDate = data[i][0];
    const formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) {
      sheet.deleteRow(i + 1);
    }
  }
}

/**
 * エラーログを記録
 */
function logError_(source, message) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.ALERT_LOG);
    if (sheet) {
      const now = new Date();
      sheet.appendRow([
        Utilities.formatDate(now, 'Asia/Tokyo', 'yyyy-MM-dd'),
        Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm:ss'),
        'エラー',
        source,
        message,
        '-',
        'データ取得に失敗しました。設定を確認してください。'
      ]);
    }
  } catch (e) {
    Logger.log('エラーログ記録失敗: ' + e.message);
  }
}
