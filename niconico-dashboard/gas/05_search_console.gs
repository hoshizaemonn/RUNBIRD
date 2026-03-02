/**
 * ============================================================
 * 05_search_console.gs - Search Console API データ取得
 * ============================================================
 *
 * Search Console API を使用:
 * - オーガニック表示回数、クリック数、CTR、平均掲載順位
 * - 検索クエリ別データ
 *
 * 前提:
 * - GASで「Search Console API」を有効化
 * - relief-trust.com がSearch Consoleに登録済み
 */

function fetchSearchConsoleData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // Search Consoleは2-3日前のデータしか取得できない（データ処理遅延）
  const targetDate = getDateNDaysAgo_(3);

  try {
    const scData = fetchSCQueryData_(targetDate);
    writeSCData_(ss, targetDate, scData);

    // サマリーも日次サマリーに書き込み
    const summary = calcSCSummary_(scData);
    writeSCSummary_(ss, targetDate, summary);

    Logger.log('Search Consoleデータ取得完了: ' + targetDate);
  } catch (e) {
    Logger.log('Search Console取得エラー: ' + e.message);
    logError_('Search Console', e.message);
  }
}

/**
 * Search Console API でクエリ別データを取得
 */
function fetchSCQueryData_(date) {
  const siteUrl = CONFIG.SEARCH_CONSOLE.SITE_URL;
  const url = 'https://www.googleapis.com/webmasters/v3/sites/' +
    encodeURIComponent(siteUrl) + '/searchAnalytics/query';

  const payload = {
    startDate: date,
    endDate: date,
    dimensions: ['query'],
    rowLimit: 100,
  };

  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    headers: {
      'Authorization': 'Bearer ' + ScriptApp.getOAuthToken(),
      'Content-Type': 'application/json',
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('SC API Error (' + response.getResponseCode() + '): ' + response.getContentText());
  }

  const result = JSON.parse(response.getContentText());
  if (!result.rows) return [];

  return result.rows.map(row => ({
    query: row.keys[0],
    impressions: row.impressions || 0,
    clicks: row.clicks || 0,
    ctr: row.ctr || 0,
    position: row.position || 0,
  }));
}

function calcSCSummary_(data) {
  let totalImp = 0, totalClicks = 0, totalPosition = 0, count = 0;
  data.forEach(row => {
    totalImp += row.impressions;
    totalClicks += row.clicks;
    totalPosition += row.position;
    count++;
  });
  return {
    impressions: totalImp,
    clicks: totalClicks,
    ctr: totalImp > 0 ? totalClicks / totalImp : 0,
    avgPosition: count > 0 ? totalPosition / count : 0,
  };
}

function writeSCData_(ss, date, data) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.SEARCH_CONSOLE);
  removeExistingRows_(sheet, date);

  data.forEach(row => {
    sheet.appendRow([
      date, row.query, row.impressions, row.clicks, row.ctr, row.position,
    ]);
  });
}

function writeSCSummary_(ss, date, summary) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const row = findOrCreateRow_(sheet, date);

  // SC列（17〜20列目）
  sheet.getRange(row, 17).setValue(summary.impressions);
  sheet.getRange(row, 18).setValue(summary.clicks);
  sheet.getRange(row, 19).setValue(summary.ctr);
  sheet.getRange(row, 20).setValue(summary.avgPosition);
}
