/**
 * ============================================================
 * Google Ads Script（Google広告管理画面で実行）
 * ============================================================
 *
 * ★ このスクリプトは Google広告管理画面 > ツール > スクリプト に貼り付けて実行します。
 * ★ GASではなく、Google広告のスクリプト機能で動きます。
 *
 * 設定手順:
 * 1. Google広告にログイン
 * 2. ツールと設定 > 一括操作 > スクリプト
 * 3. 「+」ボタンで新規スクリプト作成
 * 4. このコードを貼り付け
 * 5. SPREADSHEET_ID を自分のスプレッドシートIDに変更
 * 6. 「承認」をクリックしてアクセスを許可
 * 7. 「プレビュー」で動作確認
 * 8. スケジュール設定 > 毎日 に設定
 */

// ==================== 設定 ====================
var SPREADSHEET_ID = '1v1aofhip86ozea4b4gHXx0L3WF4hLaZfszK58jjkuNE';
var CAMPAIGN_NAME_FILTER = 'ニコニコ';  // キャンペーン名に含まれる文字列
var DAILY_BUDGET = 15000;

// シート名
var SHEET_DAILY = '日次サマリー';
var SHEET_ADGROUP = '広告グループ別';
var SHEET_KEYWORDS = 'キーワード別';

function main() {
  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  var yesterday = getYesterday();

  Logger.log('データ取得開始: ' + yesterday);

  // ========== キャンペーンサマリー ==========
  fetchCampaignSummary(ss, yesterday);

  // ========== 広告グループ別 ==========
  fetchAdGroupData(ss, yesterday);

  // ========== キーワード別 ==========
  fetchKeywordData(ss, yesterday);

  Logger.log('全データ取得完了');
}

/**
 * キャンペーンサマリーを取得
 */
function fetchCampaignSummary(ss, date) {
  var sheet = ss.getSheetByName(SHEET_DAILY);
  if (!sheet) {
    Logger.log('シート「' + SHEET_DAILY + '」が見つかりません');
    return;
  }

  // 既に記録済みかチェック
  var data = sheet.getDataRange().getValues();
  for (var i = 1; i < data.length; i++) {
    if (formatDate(data[i][0]) === date) {
      Logger.log('日次サマリー: ' + date + ' は記録済み。上書き更新します。');
      // 既存行を更新
      updateCampaignRow(sheet, i + 1, date);
      return;
    }
  }

  // 新規行を追加
  var row = sheet.getLastRow() + 1;
  updateCampaignRow(sheet, row, date);
}

function updateCampaignRow(sheet, row, date) {
  var query = 'SELECT CampaignName, Cost, Impressions, Clicks, Ctr, AverageCpc, ' +
    'Conversions, ConversionRate, CostPerConversion ' +
    'FROM CAMPAIGN_PERFORMANCE_REPORT ' +
    'WHERE CampaignName CONTAINS_IGNORE_CASE "' + CAMPAIGN_NAME_FILTER + '" ' +
    'DURING ' + date.replace(/-/g, '') + ',' + date.replace(/-/g, '');

  var report = AdsApp.report(query);
  var rows = report.rows();

  var totalCost = 0, totalImp = 0, totalClicks = 0, totalConv = 0;

  while (rows.hasNext()) {
    var r = rows.next();
    totalCost += parseFloat(r['Cost']) || 0;
    totalImp += parseInt(r['Impressions']) || 0;
    totalClicks += parseInt(r['Clicks']) || 0;
    totalConv += parseFloat(r['Conversions']) || 0;
  }

  var ctr = totalImp > 0 ? totalClicks / totalImp : 0;
  var avgCpc = totalClicks > 0 ? totalCost / totalClicks : 0;
  var cvr = totalClicks > 0 ? totalConv / totalClicks : 0;
  var cpa = totalConv > 0 ? totalCost / totalConv : 0;
  var budgetRate = totalCost / DAILY_BUDGET;

  sheet.getRange(row, 1).setValue(date);     // 日付
  sheet.getRange(row, 2).setValue(totalCost); // 費用
  sheet.getRange(row, 3).setValue(totalImp);  // 表示回数
  sheet.getRange(row, 4).setValue(totalClicks); // クリック数
  sheet.getRange(row, 5).setValue(ctr);       // CTR
  sheet.getRange(row, 6).setValue(avgCpc);    // 平均CPC
  sheet.getRange(row, 7).setValue(totalConv); // CV数
  sheet.getRange(row, 8).setValue(cvr);       // CVR
  sheet.getRange(row, 9).setValue(cpa);       // CPA
  sheet.getRange(row, 10).setValue(budgetRate); // 予算消化率

  Logger.log('キャンペーンサマリー記録完了: 費用=' + totalCost + ' Click=' + totalClicks + ' CV=' + totalConv);
}

/**
 * 広告グループ別データを取得
 */
function fetchAdGroupData(ss, date) {
  var sheet = ss.getSheetByName(SHEET_ADGROUP);
  if (!sheet) return;

  // 既存データ削除（同日のデータ）
  removeExistingData(sheet, date);

  var query = 'SELECT AdGroupName, Cost, Impressions, Clicks, Ctr, AverageCpc, ' +
    'Conversions, ConversionRate, CostPerConversion ' +
    'FROM ADGROUP_PERFORMANCE_REPORT ' +
    'WHERE CampaignName CONTAINS_IGNORE_CASE "' + CAMPAIGN_NAME_FILTER + '" ' +
    'DURING ' + date.replace(/-/g, '') + ',' + date.replace(/-/g, '');

  var report = AdsApp.report(query);
  var rows = report.rows();

  while (rows.hasNext()) {
    var r = rows.next();
    sheet.appendRow([
      date,
      r['AdGroupName'],
      parseFloat(r['Cost']) || 0,
      parseInt(r['Impressions']) || 0,
      parseInt(r['Clicks']) || 0,
      parseFloat(r['Ctr']) || 0,
      parseFloat(r['AverageCpc']) || 0,
      parseFloat(r['Conversions']) || 0,
      parseFloat(r['ConversionRate']) || 0,
      parseFloat(r['CostPerConversion']) || 0,
    ]);
  }

  Logger.log('広告グループ別データ記録完了');
}

/**
 * キーワード別データを取得
 */
function fetchKeywordData(ss, date) {
  var sheet = ss.getSheetByName(SHEET_KEYWORDS);
  if (!sheet) return;

  removeExistingData(sheet, date);

  var query = 'SELECT Criteria, AdGroupName, KeywordMatchType, ' +
    'Cost, Impressions, Clicks, Ctr, AverageCpc, Conversions ' +
    'FROM KEYWORDS_PERFORMANCE_REPORT ' +
    'WHERE CampaignName CONTAINS_IGNORE_CASE "' + CAMPAIGN_NAME_FILTER + '" ' +
    'AND Impressions > 0 ' +
    'DURING ' + date.replace(/-/g, '') + ',' + date.replace(/-/g, '');

  var report = AdsApp.report(query);
  var rows = report.rows();

  while (rows.hasNext()) {
    var r = rows.next();
    sheet.appendRow([
      date,
      r['Criteria'],
      r['AdGroupName'],
      r['KeywordMatchType'],
      parseFloat(r['Cost']) || 0,
      parseInt(r['Impressions']) || 0,
      parseInt(r['Clicks']) || 0,
      parseFloat(r['Ctr']) || 0,
      parseFloat(r['AverageCpc']) || 0,
      parseFloat(r['Conversions']) || 0,
    ]);
  }

  Logger.log('キーワード別データ記録完了');
}

// ==================== ヘルパー ====================

function getYesterday() {
  var d = new Date();
  d.setDate(d.getDate() - 1);
  return Utilities.formatDate(d, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function formatDate(val) {
  if (val instanceof Date) {
    return Utilities.formatDate(val, 'Asia/Tokyo', 'yyyy-MM-dd');
  }
  return String(val);
}

function removeExistingData(sheet, date) {
  var data = sheet.getDataRange().getValues();
  for (var i = data.length - 1; i >= 1; i--) {
    if (formatDate(data[i][0]) === date) {
      sheet.deleteRow(i + 1);
    }
  }
}
