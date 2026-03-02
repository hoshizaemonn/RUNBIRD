/**
 * ============================================================
 * 06_line.gs - LINE Messaging API データ取得
 * ============================================================
 *
 * LINE Messaging API を使用:
 * - 友だち追加数、ブロック数、合計友だち数
 * - メッセージ配信数
 *
 * 前提:
 * - LINE Developers で Messaging API チャネルを設定済み
 * - Script Properties に LINE_CHANNEL_TOKEN を保存
 *
 * 設定方法:
 * 1. LINE Developers (https://developers.line.biz) にログイン
 * 2. プロバイダー > チャネル > Messaging API を選択
 * 3. 「チャネルアクセストークン（長期）」を発行
 * 4. GASのスクリプトプロパティに保存:
 *    PropertiesService.getScriptProperties().setProperty('LINE_CHANNEL_TOKEN', 'YOUR_TOKEN')
 */

function fetchLINEData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const yesterday = getYesterdayDate_();

  try {
    const token = PropertiesService.getScriptProperties().getProperty('LINE_CHANNEL_TOKEN');
    if (!token) {
      Logger.log('LINE: チャネルアクセストークンが設定されていません。');
      Logger.log('Script Properties に LINE_CHANNEL_TOKEN を設定してください。');
      return;
    }

    // 友だち数データ取得
    const followersData = fetchLINEFollowers_(token, yesterday);
    writeLINEData_(ss, yesterday, followersData);

    // 日次サマリーにも書き込み
    writeLINESummary_(ss, yesterday, followersData);

    Logger.log('LINEデータ取得完了: ' + yesterday);
  } catch (e) {
    Logger.log('LINEデータ取得エラー: ' + e.message);
    logError_('LINE', e.message);
  }
}

/**
 * LINE Insight Followers API
 * GET /v2/bot/insight/followers?date=YYYYMMDD
 */
function fetchLINEFollowers_(token, date) {
  const dateFormatted = date.replace(/-/g, ''); // YYYYMMDD形式
  const url = 'https://api.line.me/v2/bot/insight/followers?date=' + dateFormatted;

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
    },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error('LINE Followers API Error: ' + response.getContentText());
  }

  const result = JSON.parse(response.getContentText());

  // メッセージ配信データも取得
  const deliveryData = fetchLINEMessageDelivery_(token, dateFormatted);

  return {
    followers: result.followers || 0,        // 友だち追加数（当日）
    targetedReaches: result.targetedReaches || 0, // ターゲットリーチ
    blocks: result.blocks || 0,              // ブロック数（当日）
    // 合計友だち数は followers endpoint からは直接取得できないので
    // targetedReaches を使用（メッセージ配信可能な友だち数）
    totalFriends: result.targetedReaches || 0,
    messageDelivery: deliveryData,
  };
}

/**
 * LINE Message Delivery API
 * GET /v2/bot/insight/message/delivery?date=YYYYMMDD
 */
function fetchLINEMessageDelivery_(token, dateFormatted) {
  const url = 'https://api.line.me/v2/bot/insight/message/delivery?date=' + dateFormatted;

  try {
    const response = UrlFetchApp.fetch(url, {
      method: 'get',
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    });

    if (response.getResponseCode() !== 200) return 0;

    const result = JSON.parse(response.getContentText());
    // broadcast + targeting + auto の合計
    return (result.broadcast || 0) + (result.targeting || 0) + (result.autoResponse || 0);
  } catch (e) {
    return 0;
  }
}

function writeLINEData_(ss, date, data) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.LINE_FRIENDS);
  removeExistingRows_(sheet, date);

  sheet.appendRow([
    date,
    data.followers,
    data.blocks,
    data.totalFriends,
    data.targetedReaches,
    data.messageDelivery,
  ]);
}

function writeLINESummary_(ss, date, data) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const row = findOrCreateRow_(sheet, date);

  // LINE列（11〜12列目）
  sheet.getRange(row, 11).setValue(data.followers);       // 友だち追加数
  sheet.getRange(row, 12).setValue(data.totalFriends);    // 累計友だち数
}
