/**
 * ============================================================
 * 04_ga4.gs - GA4 Data API データ取得
 * ============================================================
 *
 * GA4 Data API v1 を使用して以下のデータを取得:
 * - セッション数、ユーザー数、エンゲージメント率、平均滞在時間
 * - 流入元別（source/medium）のセッション数
 * - LINE関連イベント数
 *
 * 前提:
 * - GASプロジェクトで「Google Analytics Data API」を有効化
 * - appsscript.json に analyticsdata スコープを追加
 */

function fetchGA4Data() {
  const yesterday = getYesterdayDate_();
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  try {
    // GA4サマリーデータ取得
    const summaryData = fetchGA4Summary_(yesterday);
    writeGA4Summary_(ss, yesterday, summaryData);

    // 流入元別データ取得
    const sourceData = fetchGA4BySource_(yesterday);
    writeGA4SourceData_(ss, yesterday, sourceData);

    // ページパス × 参照元/メディア クロスデータ取得
    const pageData = fetchGA4PagesBySource_(yesterday);
    writeGA4PageData_(ss, yesterday, pageData);

    Logger.log('GA4データ取得完了: ' + yesterday);
  } catch (e) {
    Logger.log('GA4データ取得エラー: ' + e.message);
    logError_('GA4', e.message);
  }
}

/**
 * GA4サマリーデータを取得
 */
function fetchGA4Summary_(date) {
  const propertyId = CONFIG.GA4.PROPERTY_ID;
  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport';

  const payload = {
    dateRanges: [{ startDate: date, endDate: date }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'eventCount' },
      { name: 'bounceRate' },
      { name: 'screenPageViews' },
    ],
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
    throw new Error('GA4 API Error (' + response.getResponseCode() + '): ' + response.getContentText());
  }

  const result = JSON.parse(response.getContentText());

  if (!result.rows || result.rows.length === 0) {
    return {
      sessions: 0,
      users: 0,
      engagementRate: 0,
      avgDuration: 0,
      eventCount: 0,
      bounceRate: 0,
      pageViews: 0,
    };
  }

  const values = result.rows[0].metricValues;
  return {
    sessions: parseInt(values[0].value) || 0,
    users: parseInt(values[1].value) || 0,
    engagementRate: parseFloat(values[2].value) || 0,
    avgDuration: parseFloat(values[3].value) || 0,
    eventCount: parseInt(values[4].value) || 0,
    bounceRate: parseFloat(values[5].value) || 0,
    pageViews: parseInt(values[6].value) || 0,
  };
}

/**
 * 流入元（source/medium）別データを取得
 */
function fetchGA4BySource_(date) {
  const propertyId = CONFIG.GA4.PROPERTY_ID;
  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport';

  const payload = {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [{ name: 'sessionSourceMedium' }],
    metrics: [
      { name: 'sessions' },
      { name: 'activeUsers' },
      { name: 'engagementRate' },
      { name: 'averageSessionDuration' },
      { name: 'eventCount' },
      { name: 'conversions' },
    ],
    orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
    limit: 20,
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
    throw new Error('GA4 Source API Error: ' + response.getContentText());
  }

  const result = JSON.parse(response.getContentText());
  if (!result.rows) return [];

  return result.rows.map(row => ({
    sourceMedium: row.dimensionValues[0].value,
    sessions: parseInt(row.metricValues[0].value) || 0,
    users: parseInt(row.metricValues[1].value) || 0,
    engagementRate: parseFloat(row.metricValues[2].value) || 0,
    avgDuration: parseFloat(row.metricValues[3].value) || 0,
    eventCount: parseInt(row.metricValues[4].value) || 0,
    conversions: parseInt(row.metricValues[5].value) || 0,
  }));
}

/**
 * GA4サマリーをシートに書き込み
 */
function writeGA4Summary_(ss, date, data) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const row = findOrCreateRow_(sheet, date);

  // 日次サマリーのGA4列（13列目〜）
  sheet.getRange(row, 13).setValue(data.sessions);
  sheet.getRange(row, 14).setValue(data.users);
  sheet.getRange(row, 15).setValue(data.engagementRate);
  sheet.getRange(row, 16).setValue(data.avgDuration);
}

/**
 * 流入元別データをシートに書き込み
 */
function writeGA4SourceData_(ss, date, sourceData) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GA4_DATA);

  // 同日の既存データを削除
  removeExistingRows_(sheet, date);

  sourceData.forEach(src => {
    sheet.appendRow([
      date,
      src.sourceMedium,
      src.sessions,
      src.users,
      src.engagementRate,
      src.avgDuration,
      src.eventCount,
      src.conversions,
    ]);
  });
}

/**
 * ページパス × 参照元/メディア のクロスデータを取得
 */
function fetchGA4PagesBySource_(date) {
  const propertyId = CONFIG.GA4.PROPERTY_ID;
  const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport';

  const payload = {
    dateRanges: [{ startDate: date, endDate: date }],
    dimensions: [
      { name: 'pagePath' },
      { name: 'sessionSourceMedium' },
    ],
    metrics: [
      { name: 'screenPageViews' },
      { name: 'activeUsers' },
      { name: 'userEngagementDuration' },
      { name: 'eventCount' },
    ],
    orderBys: [{ metric: { metricName: 'screenPageViews' }, desc: true }],
    limit: 100,
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
    throw new Error('GA4 Pages API Error: ' + response.getContentText());
  }

  const result = JSON.parse(response.getContentText());
  if (!result.rows) return [];

  return result.rows.map(row => ({
    pagePath: row.dimensionValues[0].value,
    sourceMedium: row.dimensionValues[1].value,
    pageViews: parseInt(row.metricValues[0].value) || 0,
    activeUsers: parseInt(row.metricValues[1].value) || 0,
    engagementDuration: parseFloat(row.metricValues[2].value) || 0,
    eventCount: parseInt(row.metricValues[3].value) || 0,
  }));
}

/**
 * ページ別データをシートに書き込み
 */
function writeGA4PageData_(ss, date, pageData) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.GA4_PAGES);

  // 同日の既存データを削除
  removeExistingRows_(sheet, date);

  pageData.forEach(row => {
    sheet.appendRow([
      date,
      row.pagePath,
      row.sourceMedium,
      row.pageViews,
      row.activeUsers,
      row.engagementDuration,
      row.eventCount,
    ]);
  });
}
