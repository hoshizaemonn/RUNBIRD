/**
 * ============================================================
 * Google Ads Script - 日次データエクスポート
 * ============================================================
 *
 * Google Ads管理画面の「スクリプト」機能で実行します。
 * Developer Token 不要。管理画面内蔵のスクリプト実行環境を使用。
 *
 * 設定:
 * 1. Google Ads管理画面 → ツールと設定 → スクリプト
 * 2. このスクリプトを貼り付けて保存
 * 3. 毎朝8:50に定期実行を設定
 *
 * 出力先: Google Spreadsheet（GASと共有）
 */

// ==================== 設定 ====================
var SPREADSHEET_URL = 'https://docs.google.com/spreadsheets/d/1sFhj5viP_uMap0nqy3M5Y584orGLlvhQWxYU96CWmoI/edit';
var CAMPAIGN_NAME = 'ニコニコカーローン';

// シート名（01_config.gs の CONFIG.SHEETS と一致させること）
var SHEET_NAMES = {
  DAILY_SUMMARY: '日次サマリー',
  AD_GROUP: '広告グループ別',
  KEYWORDS: 'キーワード別',
  SEARCH_TERMS: '検索語句',
  HOURLY: '時間帯別',
  DEVICES: 'デバイス別',
  NETWORK: 'ネットワーク別',
  GENDER: '性別',
  AGE: '年齢',
};

// ==================== メイン関数 ====================
function main() {
  var ss = SpreadsheetApp.openByUrl(SPREADSHEET_URL);
  var yesterday = getYesterday();
  Logger.log('=== Google Ads Daily Export: ' + yesterday + ' ===');

  // 1. キャンペーンサマリー
  exportCampaignSummary(ss, yesterday);

  // 2. 広告グループ別
  exportAdGroups(ss, yesterday);

  // 3. キーワード別
  exportKeywords(ss, yesterday);

  // 4. 検索語句
  exportSearchTerms(ss, yesterday);

  // 5. 時間帯別
  exportHourly(ss, yesterday);

  // 6. デバイス別
  exportDevices(ss, yesterday);

  // 7. ネットワーク別
  exportNetwork(ss, yesterday);

  // 8. 性別
  exportGender(ss, yesterday);

  // 9. 年齢
  exportAge(ss, yesterday);

  Logger.log('=== Export完了 ===');
}

// ==================== キャンペーンサマリー ====================
function exportCampaignSummary(ss, date) {
  var query = 'SELECT ' +
    'campaign.name, ' +
    'metrics.cost_micros, ' +
    'metrics.impressions, ' +
    'metrics.clicks, ' +
    'metrics.ctr, ' +
    'metrics.average_cpc, ' +
    'metrics.conversions, ' +
    'metrics.conversions_from_interactions_rate, ' +
    'metrics.cost_per_conversion ' +
    'FROM campaign ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '"';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.DAILY_SUMMARY);

  while (rows.hasNext()) {
    var row = rows.next();
    var campaign = row.campaign;
    var metrics = row.metrics;

    var cost = metrics.costMicros / 1000000;
    var cpc = metrics.averageCpc / 1000000;
    var cpa = metrics.costPerConversion / 1000000;
    var ctr = metrics.ctr * 100;
    var cvr = metrics.conversionsFromInteractionsRate * 100;

    // 既存の日付行を探すか新規作成
    var rowNum = findOrCreateRow(sheet, date);
    sheet.getRange(rowNum, 1).setValue(date);
    sheet.getRange(rowNum, 2).setValue(Math.round(cost));       // 費用
    sheet.getRange(rowNum, 3).setValue(metrics.impressions);     // 表示回数
    sheet.getRange(rowNum, 4).setValue(metrics.clicks);          // クリック数
    sheet.getRange(rowNum, 5).setValue(parseFloat(ctr.toFixed(2)));  // CTR
    sheet.getRange(rowNum, 6).setValue(Math.round(cpc));         // 平均CPC
    sheet.getRange(rowNum, 7).setValue(metrics.conversions);     // CV数
    sheet.getRange(rowNum, 8).setValue(parseFloat(cvr.toFixed(2)));  // CVR
    sheet.getRange(rowNum, 9).setValue(Math.round(cpa));         // CPA
    sheet.getRange(rowNum, 10).setValue(
      parseFloat((cost / 15000 * 100).toFixed(1))               // 予算消化率
    );

    Logger.log('キャンペーン: ' + campaign.name +
      ' | 費用: ¥' + Math.round(cost) +
      ' | クリック: ' + metrics.clicks +
      ' | CV: ' + metrics.conversions);
  }
}

// ==================== 広告グループ別 ====================
function exportAdGroups(ss, date) {
  var query = 'SELECT ' +
    'ad_group.name, ' +
    'metrics.cost_micros, ' +
    'metrics.impressions, ' +
    'metrics.clicks, ' +
    'metrics.ctr, ' +
    'metrics.average_cpc, ' +
    'metrics.conversions, ' +
    'metrics.conversions_from_interactions_rate, ' +
    'metrics.cost_per_conversion ' +
    'FROM ad_group ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.clicks DESC';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.AD_GROUP);
  removeExistingRows(sheet, date);

  while (rows.hasNext()) {
    var row = rows.next();
    var m = row.metrics;
    sheet.appendRow([
      date,
      row.adGroup.name,
      Math.round(m.costMicros / 1000000),
      m.impressions,
      m.clicks,
      parseFloat((m.ctr * 100).toFixed(2)),
      Math.round(m.averageCpc / 1000000),
      m.conversions,
      parseFloat((m.conversionsFromInteractionsRate * 100).toFixed(2)),
      Math.round(m.costPerConversion / 1000000),
    ]);
  }
  Logger.log('広告グループ別: 書き込み完了');
}

// ==================== キーワード別 ====================
function exportKeywords(ss, date) {
  var query = 'SELECT ' +
    'ad_group_criterion.keyword.text, ' +
    'ad_group.name, ' +
    'ad_group_criterion.keyword.match_type, ' +
    'metrics.cost_micros, ' +
    'metrics.impressions, ' +
    'metrics.clicks, ' +
    'metrics.ctr, ' +
    'metrics.average_cpc, ' +
    'metrics.conversions ' +
    'FROM keyword_view ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.clicks DESC';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.KEYWORDS);
  removeExistingRows(sheet, date);

  while (rows.hasNext()) {
    var row = rows.next();
    var m = row.metrics;
    var kw = row.adGroupCriterion.keyword;
    sheet.appendRow([
      date,
      kw.text,
      row.adGroup.name,
      formatMatchType(kw.matchType),
      Math.round(m.costMicros / 1000000),
      m.impressions,
      m.clicks,
      parseFloat((m.ctr * 100).toFixed(2)),
      Math.round(m.averageCpc / 1000000),
      m.conversions,
    ]);
  }
  Logger.log('キーワード別: 書き込み完了');
}

// ==================== 検索語句 ====================
function exportSearchTerms(ss, date) {
  var query = 'SELECT ' +
    'search_term_view.search_term, ' +
    'metrics.cost_micros, ' +
    'metrics.clicks, ' +
    'metrics.impressions ' +
    'FROM search_term_view ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.impressions DESC ' +
    'LIMIT 50';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.SEARCH_TERMS);
  removeExistingRows(sheet, date);

  while (rows.hasNext()) {
    var row = rows.next();
    var m = row.metrics;
    sheet.appendRow([
      date,
      row.searchTermView.searchTerm,
      Math.round(m.costMicros / 1000000),
      m.clicks,
      m.impressions,
    ]);
  }
  Logger.log('検索語句: 書き込み完了');
}

// ==================== 時間帯別 ====================
function exportHourly(ss, date) {
  var query = 'SELECT ' +
    'segments.hour, ' +
    'metrics.clicks, ' +
    'metrics.impressions, ' +
    'metrics.average_cpc, ' +
    'metrics.cost_micros ' +
    'FROM campaign ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'ORDER BY segments.hour';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.HOURLY);
  removeExistingRows(sheet, date);

  while (rows.hasNext()) {
    var row = rows.next();
    var m = row.metrics;
    var hour = row.segments.hour;
    sheet.appendRow([
      date,
      hour + '時〜' + (hour + 1) + '時',
      m.clicks,
      m.impressions,
      Math.round(m.averageCpc / 1000000),
      Math.round(m.costMicros / 1000000),
    ]);
  }
  Logger.log('時間帯別: 書き込み完了');
}

// ==================== デバイス別 ====================
function exportDevices(ss, date) {
  var query = 'SELECT ' +
    'segments.device, ' +
    'metrics.cost_micros, ' +
    'metrics.impressions, ' +
    'metrics.clicks ' +
    'FROM campaign ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.clicks DESC';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.DEVICES);
  removeExistingRows(sheet, date);

  while (rows.hasNext()) {
    var row = rows.next();
    var m = row.metrics;
    sheet.appendRow([
      date,
      formatDevice(row.segments.device),
      Math.round(m.costMicros / 1000000),
      m.impressions,
      m.clicks,
    ]);
  }
  Logger.log('デバイス別: 書き込み完了');
}

// ==================== ネットワーク別 ====================
function exportNetwork(ss, date) {
  var query = 'SELECT ' +
    'segments.ad_network_type, ' +
    'metrics.clicks, ' +
    'metrics.cost_micros, ' +
    'metrics.average_cpc ' +
    'FROM campaign ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.clicks DESC';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.NETWORK);
  removeExistingRows(sheet, date);

  while (rows.hasNext()) {
    var row = rows.next();
    var m = row.metrics;
    sheet.appendRow([
      date,
      formatNetwork(row.segments.adNetworkType),
      m.clicks,
      Math.round(m.costMicros / 1000000),
      Math.round(m.averageCpc / 1000000),
    ]);
  }
  Logger.log('ネットワーク別: 書き込み完了');
}

// ==================== 性別 ====================
function exportGender(ss, date) {
  var query = 'SELECT ' +
    'ad_group_criterion.gender.type, ' +
    'metrics.impressions ' +
    'FROM gender_view ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.impressions DESC';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.GENDER);
  removeExistingRows(sheet, date);

  // Collect all rows to calculate percentages
  var data = [];
  var totalImpressions = 0;
  while (rows.hasNext()) {
    var row = rows.next();
    var impressions = row.metrics.impressions;
    data.push({
      gender: formatGender(row.adGroupCriterion.gender.type),
      impressions: impressions,
    });
    totalImpressions += impressions;
  }

  data.forEach(function(d) {
    var pct = totalImpressions > 0 ? (d.impressions / totalImpressions * 100) : 0;
    sheet.appendRow([date, d.gender, d.impressions, parseFloat(pct.toFixed(2))]);
  });
  Logger.log('性別: 書き込み完了');
}

// ==================== 年齢 ====================
function exportAge(ss, date) {
  var query = 'SELECT ' +
    'ad_group_criterion.age_range.type, ' +
    'metrics.impressions ' +
    'FROM age_range_view ' +
    'WHERE campaign.name LIKE "%' + CAMPAIGN_NAME + '%" ' +
    'AND segments.date = "' + date + '" ' +
    'AND metrics.impressions > 0 ' +
    'ORDER BY metrics.impressions DESC';

  var rows = AdsApp.search(query);
  var sheet = getOrCreateSheet(ss, SHEET_NAMES.AGE);
  removeExistingRows(sheet, date);

  var data = [];
  var totalImpressions = 0;
  while (rows.hasNext()) {
    var row = rows.next();
    var impressions = row.metrics.impressions;
    data.push({
      ageRange: formatAgeRange(row.adGroupCriterion.ageRange.type),
      impressions: impressions,
    });
    totalImpressions += impressions;
  }

  data.forEach(function(d) {
    var pct = totalImpressions > 0 ? (d.impressions / totalImpressions * 100) : 0;
    sheet.appendRow([date, d.ageRange, d.impressions, parseFloat(pct.toFixed(2))]);
  });
  Logger.log('年齢: 書き込み完了');
}

// ==================== ヘルパー関数 ====================

function getYesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function getOrCreateSheet(ss, name) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  return sheet;
}

function findOrCreateRow(sheet, date) {
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    var rowDate = data[i][0];
    var formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) return i + 1;
  }
  return sheet.getLastRow() + 1;
}

function removeExistingRows(sheet, date) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    var rowDate = data[i][0];
    var formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) {
      sheet.deleteRow(i + 1);
    }
  }
}

function formatMatchType(type) {
  var map = {
    'BROAD': 'インテント',
    'PHRASE': 'フレーズ',
    'EXACT': '完全一致',
  };
  return map[type] || type;
}

function formatDevice(device) {
  var map = {
    'MOBILE': 'スマートフォン',
    'DESKTOP': 'パソコン',
    'TABLET': 'タブレット',
    'CONNECTED_TV': 'コネクテッドTV',
    'OTHER': 'その他',
  };
  return map[device] || device;
}

function formatNetwork(network) {
  var map = {
    'SEARCH': 'Google 検索',
    'SEARCH_PARTNERS': '検索パートナー',
    'CONTENT': 'ディスプレイ ネットワーク',
    'YOUTUBE_SEARCH': 'YouTube 検索',
    'YOUTUBE_WATCH': 'YouTube 動画',
    'MIXED': '混合',
  };
  return map[network] || network;
}

function formatGender(type) {
  var map = {
    'MALE': '男性',
    'FEMALE': '女性',
    'UNDETERMINED': '不明',
  };
  return map[type] || type;
}

function formatAgeRange(type) {
  var map = {
    'AGE_RANGE_18_24': '18〜24歳',
    'AGE_RANGE_25_34': '25〜34歳',
    'AGE_RANGE_35_44': '35〜44歳',
    'AGE_RANGE_45_54': '45〜54歳',
    'AGE_RANGE_55_64': '55〜64歳',
    'AGE_RANGE_65_UP': '65歳以上',
    'AGE_RANGE_UNDETERMINED': '不明',
  };
  return map[type] || type;
}
