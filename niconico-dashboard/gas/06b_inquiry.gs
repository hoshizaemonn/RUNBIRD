/**
 * ============================================================
 * 06b_inquiry.gs - 問い合わせ（送客管理）データ取得
 * ============================================================
 *
 * 送客管理スプレッドシートから問い合わせデータを取得し、
 * 日別の問い合わせ件数を集計します。
 *
 * テストデータ（氏名に「てすと」「テスト」を含む）と
 * 重複データ（備考に「重複」を含む）は除外します。
 *
 * 送客管理スプレッドシート:
 *   ID: 1ljthaoBW-FfVV6QQy6NRpbvKHI5rm8BIM7wGbarcwS0
 *   列: 申込日時, 氏名, フリガナ, 電話番号, 都道府県, ...
 */

/**
 * 問い合わせデータを取得してメインスプレッドシートに記録
 */
function fetchInquiryData() {
  const yesterday = getYesterdayDate_();

  try {
    const inquirySS = SpreadsheetApp.openById(CONFIG.INQUIRY.SPREADSHEET_ID);
    const sheet = CONFIG.INQUIRY.SHEET_NAME
      ? inquirySS.getSheetByName(CONFIG.INQUIRY.SHEET_NAME)
      : inquirySS.getSheets()[0];

    if (!sheet) {
      Logger.log('問い合わせ: シートが見つかりません');
      return;
    }

    const data = sheet.getDataRange().getValues();
    const inquiries = filterInquiriesForDate_(data, yesterday);

    Logger.log('問い合わせ: ' + yesterday + ' の有効件数 = ' + inquiries.length);

    // メインスプレッドシートに記録
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    writeInquiryData_(ss, yesterday, inquiries);

    Logger.log('問い合わせデータ記録完了: ' + yesterday);
  } catch (e) {
    Logger.log('問い合わせデータ取得エラー: ' + e.message);
    logError_('問い合わせ', e.message);
  }
}

/**
 * 指定日の問い合わせをフィルタリング
 * テスト・重複を除外して有効な問い合わせのみ返す
 *
 * @param {Array<Array>} data - シートの全データ（ヘッダー含む）
 * @param {string} date - 'yyyy-MM-dd' 形式の日付
 * @returns {Array<Object>} 有効な問い合わせリスト
 */
function filterInquiriesForDate_(data, date) {
  const dateCol = CONFIG.INQUIRY.DATE_COLUMN;
  const nameCol = CONFIG.INQUIRY.NAME_COLUMN;
  const remarksCol = CONFIG.INQUIRY.REMARKS_COLUMN;

  const results = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];

    // 申込日時を日付文字列に変換
    const rawDate = row[dateCol];
    if (!rawDate) continue;

    let rowDateStr = '';
    if (rawDate instanceof Date) {
      rowDateStr = Utilities.formatDate(rawDate, 'Asia/Tokyo', 'yyyy-MM-dd');
    } else {
      // "2026/03/02 12:00" や "2026-03-02 12:00" 形式に対応
      const str = String(rawDate).trim();
      const match = str.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
      if (match) {
        rowDateStr = match[1] + '-' +
          match[2].padStart(2, '0') + '-' +
          match[3].padStart(2, '0');
      }
    }

    if (rowDateStr !== date) continue;

    // 氏名を取得
    const name = String(row[nameCol] || '').trim();
    if (!name) continue;

    // テストデータを除外（氏名に「てすと」「テスト」「test」を含む）
    const nameLower = name.toLowerCase();
    if (nameLower.includes('てすと') ||
        nameLower.includes('テスト') ||
        nameLower.includes('test')) {
      Logger.log('問い合わせ除外（テスト）: ' + name);
      continue;
    }

    // 備考に「重複」を含む行を除外
    const remarks = String(row[remarksCol] || '').trim();
    if (remarks.includes('重複')) {
      Logger.log('問い合わせ除外（重複）: ' + name);
      continue;
    }

    results.push({
      date: rowDateStr,
      name: name,
      prefecture: String(row[4] || ''),  // 都道府県
    });
  }

  return results;
}

/**
 * 問い合わせデータをメインスプレッドシートに書き込み
 */
function writeInquiryData_(ss, date, inquiries) {
  let sheet = ss.getSheetByName(CONFIG.SHEETS.INQUIRY);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.SHEETS.INQUIRY);
    sheet.appendRow(['日付', '件数', '備考']);
  }

  removeExistingRows_(sheet, date);

  sheet.appendRow([
    date,
    inquiries.length,
    inquiries.map(function(inq) { return inq.name; }).join(', '),
  ]);
}

/**
 * 指定日の問い合わせ件数を取得（JSON構築用）
 * buildDashboardJSON() から呼ばれる
 *
 * @param {string} dateStr - 'yyyy-MM-dd'
 * @returns {Object} { count: number, details: Array }
 */
function getInquiryCountForDate(dateStr) {
  try {
    const inquirySS = SpreadsheetApp.openById(CONFIG.INQUIRY.SPREADSHEET_ID);
    const sheet = CONFIG.INQUIRY.SHEET_NAME
      ? inquirySS.getSheetByName(CONFIG.INQUIRY.SHEET_NAME)
      : inquirySS.getSheets()[0];

    if (!sheet) return { count: 0, details: [] };

    const data = sheet.getDataRange().getValues();
    const inquiries = filterInquiriesForDate_(data, dateStr);

    return {
      count: inquiries.length,
      details: inquiries.map(function(inq) {
        return {
          date: inq.date,
          prefecture: inq.prefecture,
        };
      }),
    };
  } catch (e) {
    Logger.log('問い合わせ件数取得エラー: ' + e.message);
    return { count: 0, details: [] };
  }
}
