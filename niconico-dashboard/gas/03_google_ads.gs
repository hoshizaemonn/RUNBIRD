/**
 * ============================================================
 * 03_google_ads.gs - Google広告データ取得
 * ============================================================
 *
 * ★ 重要: Google広告データは2通りの方法で取得できます
 *
 * 方法A: Google Ads Script（推奨・簡単）
 *   → Google広告の管理画面 > ツール > スクリプト から実行
 *   → このファイルの「GOOGLE ADS SCRIPT版」をコピペ
 *
 * 方法B: Google Ads API（GASから直接）
 *   → OAuth2ライブラリが必要
 *   → Developer Tokenが必要（申請に時間がかかる場合あり）
 *
 * まずは方法Aで始めることを推奨します。
 */

// ============================================================
// 方法A: Google Ads Script版（Google広告管理画面から実行）
// ============================================================
// 以下のコードを Google広告 > ツール > スクリプト にコピペしてください。
// ※ このファイルはGAS側には貼りません。別途 google_ads_script.js として保存済み。

/**
 * 方法B: GASからGoogle Ads APIを呼ぶ場合
 * ※ Google Ads API の Developer Token + OAuth2 が必要
 */
function fetchGoogleAdsData() {
  const yesterday = getYesterdayDate_();

  try {
    // まずスプレッドシートに既にデータがあるかチェック
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const summarySheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
    if (isDateAlreadyRecorded_(summarySheet, yesterday)) {
      Logger.log('Google広告: ' + yesterday + ' のデータは既に記録済みです');
      return;
    }

    // Google Ads APIでデータ取得を試みる
    const adsData = fetchAdsDataViaAPI_(yesterday);

    if (adsData) {
      writeAdsSummary_(ss, yesterday, adsData.summary);
      writeAdsGroupData_(ss, yesterday, adsData.adGroups);
      writeAdsKeywordData_(ss, yesterday, adsData.keywords);
      Logger.log('Google広告データの取得・記録が完了しました: ' + yesterday);
    }
  } catch (e) {
    Logger.log('Google広告データ取得エラー: ' + e.message);
    logError_('Google広告', e.message);
  }
}

/**
 * Google Ads API でデータを取得
 * ※ OAuth2 ライブラリとDeveloper Tokenが必要
 */
function fetchAdsDataViaAPI_(date) {
  const props = PropertiesService.getScriptProperties();
  const developerToken = props.getProperty('ADS_DEVELOPER_TOKEN');
  const accessToken = getAdsOAuth2Token_();

  if (!developerToken || !accessToken) {
    Logger.log('Google Ads API の認証情報が設定されていません。');
    Logger.log('Google Ads Script版を使用するか、Script Propertiesに ADS_DEVELOPER_TOKEN を設定してください。');
    return null;
  }

  const customerId = CONFIG.GOOGLE_ADS.CUSTOMER_ID;
  const baseUrl = 'https://googleads.googleapis.com/v18/customers/' + customerId + '/googleAds:searchStream';

  // キャンペーンサマリー
  const summaryQuery = `
    SELECT
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_from_interactions_rate,
      metrics.cost_per_conversion
    FROM campaign
    WHERE segments.date = '${date}'
      AND campaign.name LIKE '%${CONFIG.GOOGLE_ADS.CAMPAIGN_NAME}%'
  `;

  // 広告グループ別
  const adGroupQuery = `
    SELECT
      ad_group.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions,
      metrics.conversions_from_interactions_rate,
      metrics.cost_per_conversion
    FROM ad_group
    WHERE segments.date = '${date}'
      AND campaign.name LIKE '%${CONFIG.GOOGLE_ADS.CAMPAIGN_NAME}%'
  `;

  // キーワード別
  const keywordQuery = `
    SELECT
      ad_group_criterion.keyword.text,
      ad_group_criterion.keyword.match_type,
      ad_group.name,
      metrics.cost_micros,
      metrics.impressions,
      metrics.clicks,
      metrics.ctr,
      metrics.average_cpc,
      metrics.conversions
    FROM keyword_view
    WHERE segments.date = '${date}'
      AND campaign.name LIKE '%${CONFIG.GOOGLE_ADS.CAMPAIGN_NAME}%'
  `;

  const headers = {
    'Authorization': 'Bearer ' + accessToken,
    'developer-token': developerToken,
    'Content-Type': 'application/json',
  };

  const summaryResult = callAdsAPI_(baseUrl, summaryQuery, headers);
  const adGroupResult = callAdsAPI_(baseUrl, adGroupQuery, headers);
  const keywordResult = callAdsAPI_(baseUrl, keywordQuery, headers);

  return {
    summary: parseAdsSummary_(summaryResult),
    adGroups: parseAdsAdGroups_(adGroupResult),
    keywords: parseAdsKeywords_(keywordResult),
  };
}

function callAdsAPI_(url, query, headers) {
  const options = {
    method: 'post',
    headers: headers,
    payload: JSON.stringify({ query: query }),
    muteHttpExceptions: true,
  };
  const response = UrlFetchApp.fetch(url, options);
  if (response.getResponseCode() !== 200) {
    throw new Error('Google Ads API Error: ' + response.getContentText());
  }
  return JSON.parse(response.getContentText());
}

function parseAdsSummary_(result) {
  if (!result || !result.length) return null;
  const row = result[0].results[0];
  const m = row.metrics;
  return {
    cost: (m.costMicros || 0) / 1000000,
    impressions: m.impressions || 0,
    clicks: m.clicks || 0,
    ctr: m.ctr || 0,
    avgCpc: (m.averageCpc || 0) / 1000000,
    conversions: m.conversions || 0,
    cvr: m.conversionsFromInteractionsRate || 0,
    cpa: (m.costPerConversion || 0) / 1000000,
  };
}

function parseAdsAdGroups_(result) {
  if (!result || !result.length) return [];
  return result[0].results.map(row => ({
    name: row.adGroup.name,
    cost: (row.metrics.costMicros || 0) / 1000000,
    impressions: row.metrics.impressions || 0,
    clicks: row.metrics.clicks || 0,
    ctr: row.metrics.ctr || 0,
    avgCpc: (row.metrics.averageCpc || 0) / 1000000,
    conversions: row.metrics.conversions || 0,
    cvr: row.metrics.conversionsFromInteractionsRate || 0,
    cpa: (row.metrics.costPerConversion || 0) / 1000000,
  }));
}

function parseAdsKeywords_(result) {
  if (!result || !result.length) return [];
  return result[0].results.map(row => ({
    keyword: row.adGroupCriterion.keyword.text,
    matchType: row.adGroupCriterion.keyword.matchType,
    adGroup: row.adGroup.name,
    cost: (row.metrics.costMicros || 0) / 1000000,
    impressions: row.metrics.impressions || 0,
    clicks: row.metrics.clicks || 0,
    ctr: row.metrics.ctr || 0,
    avgCpc: (row.metrics.averageCpc || 0) / 1000000,
    conversions: row.metrics.conversions || 0,
  }));
}

/**
 * データをシートに書き込む
 */
function writeAdsSummary_(ss, date, summary) {
  if (!summary) return;
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const budgetRate = summary.cost / CONFIG.GOOGLE_ADS.DAILY_BUDGET;

  // 既存行を探すか、新規行を追加
  const row = findOrCreateRow_(sheet, date);
  sheet.getRange(row, 1).setValue(date);
  sheet.getRange(row, 2).setValue(summary.cost);
  sheet.getRange(row, 3).setValue(summary.impressions);
  sheet.getRange(row, 4).setValue(summary.clicks);
  sheet.getRange(row, 5).setValue(summary.ctr);
  sheet.getRange(row, 6).setValue(summary.avgCpc);
  sheet.getRange(row, 7).setValue(summary.conversions);
  sheet.getRange(row, 8).setValue(summary.cvr);
  sheet.getRange(row, 9).setValue(summary.cpa);
  sheet.getRange(row, 10).setValue(budgetRate);
}

function writeAdsGroupData_(ss, date, adGroups) {
  if (!adGroups || !adGroups.length) return;
  const sheet = ss.getSheetByName(CONFIG.SHEETS.AD_GROUP);
  adGroups.forEach(ag => {
    sheet.appendRow([
      date, ag.name, ag.cost, ag.impressions, ag.clicks,
      ag.ctr, ag.avgCpc, ag.conversions, ag.cvr, ag.cpa
    ]);
  });
}

function writeAdsKeywordData_(ss, date, keywords) {
  if (!keywords || !keywords.length) return;
  const sheet = ss.getSheetByName(CONFIG.SHEETS.KEYWORDS);
  keywords.forEach(kw => {
    sheet.appendRow([
      date, kw.keyword, kw.adGroup, kw.matchType,
      kw.cost, kw.impressions, kw.clicks, kw.ctr, kw.avgCpc, kw.conversions
    ]);
  });
}

/**
 * OAuth2 トークン取得（Google Ads API用）
 * OAuth2ライブラリ: 1B7FSrk5Zi6L1rSxxTDgDEUsPzlukDsi4KGuTMorsTQHhGBzBkMun4iDF
 */
function getAdsOAuth2Token_() {
  // OAuth2ライブラリを使用する場合はここを実装
  // 簡易的にScript Propertiesから取得
  return PropertiesService.getScriptProperties().getProperty('ADS_ACCESS_TOKEN');
}
