/**
 * ============================================================
 * 11_webapp.gs - GAS Web App ダッシュボード
 * ============================================================
 *
 * このファイルはGAS Web Appとして動作します。
 * - doGet() : HTMLダッシュボードを配信
 * - getData() : 指定日付のダッシュボードデータを返す
 * - getAvailableDates() : 利用可能な日付リストを返す
 */

/**
 * GAS Web App エントリーポイント
 * ブラウザからアクセスされる時、このHTMLが配信される
 */
function doGet() {
  const html = HtmlService.createTemplateFromFile('dashboard').evaluate();
  html.setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  return html;
}

/**
 * 指定日付のダッシュボードデータを取得
 * @param {string} dateStr - 日付文字列 (yyyy-MM-dd形式)、省略時は最新日付
 * @returns {object} ダッシュボードデータ
 */
function getData(dateStr) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

    // 日付が指定されていない場合は最新日付を使用
    if (!dateStr) {
      const availableDates = getAvailableDates();
      dateStr = availableDates.length > 0 ? availableDates[0] : getYesterdayDate_();
    }

    // 各シートからデータを取得
    const summarySheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
    const adGroupSheet = ss.getSheetByName(CONFIG.SHEETS.AD_GROUP);
    const keywordsSheet = ss.getSheetByName(CONFIG.SHEETS.KEYWORDS);
    const ga4Sheet = ss.getSheetByName(CONFIG.SHEETS.GA4_DATA);
    const scSheet = ss.getSheetByName(CONFIG.SHEETS.SEARCH_CONSOLE);
    const claritySheet = ss.getSheetByName(CONFIG.SHEETS.CLARITY);
    const lineSheet = ss.getSheetByName(CONFIG.SHEETS.LINE_FRIENDS);
    const alertSheet = ss.getSheetByName(CONFIG.SHEETS.ALERT_LOG);

    const result = {
      date: dateStr,
      summary: getSummaryData_(summarySheet, dateStr),
      adGroups: getAdGroupData_(adGroupSheet, dateStr),
      keywords: getKeywordData_(keywordsSheet, dateStr),
      ga4Sources: getGA4SourceData_(ga4Sheet, dateStr),
      searchConsole: getSearchConsoleData_(scSheet, dateStr),
      clarity: getClarityData_(claritySheet, dateStr),
      line: getLineData_(lineSheet, dateStr),
      alerts: getAlertData_(alertSheet, dateStr),
      trendData: getTrendData_(summarySheet),
      benchmarks: BENCHMARKS,
    };

    return result;
  } catch (e) {
    Logger.log('getData エラー: ' + e.message);
    return {
      error: true,
      message: e.message,
      date: dateStr || getYesterdayDate_(),
    };
  }
}

/**
 * 利用可能な日付一覧を取得
 * @returns {array} 日付の配列 (新しい順)
 */
function getAvailableDates() {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);

    if (!sheet) return [];

    const data = sheet.getDataRange().getValues();
    const dates = [];

    // ヘッダー行をスキップ
    for (let i = 1; i < data.length; i++) {
      const dateValue = data[i][0];
      if (!dateValue) continue;

      let dateStr;
      if (dateValue instanceof Date) {
        dateStr = Utilities.formatDate(dateValue, 'Asia/Tokyo', 'yyyy-MM-dd');
      } else {
        dateStr = String(dateValue);
      }

      if (dateStr && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
        dates.push(dateStr);
      }
    }

    // 新しい順にソート
    dates.sort().reverse();
    return dates;
  } catch (e) {
    Logger.log('getAvailableDates エラー: ' + e.message);
    return [];
  }
}

/**
 * 日次サマリーデータを取得
 * @private
 */
function getSummaryData_(sheet, dateStr) {
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      return {
        date: dateStr,
        cost: parseFloat(data[i][1]) || 0,                    // B: 費用
        impressions: parseInt(data[i][2]) || 0,               // C: 表示回数
        clicks: parseInt(data[i][3]) || 0,                    // D: クリック数
        ctr: parseFloat(data[i][4]) || 0,                     // E: CTR
        avgCpc: parseFloat(data[i][5]) || 0,                  // F: 平均CPC
        conversions: parseInt(data[i][6]) || 0,               // G: CV数
        cvr: parseFloat(data[i][7]) || 0,                     // H: CVR
        cpa: parseFloat(data[i][8]) || 0,                     // I: CPA
        budgetRate: parseFloat(data[i][9]) || 0,              // J: 予算消化率
        sessions: parseInt(data[i][12]) || 0,                 // M: セッション
        users: parseInt(data[i][13]) || 0,                    // N: ユーザー
        engagementRate: parseFloat(data[i][14]) || 0,         // O: エンゲージメント率
        avgSessionDuration: parseFloat(data[i][15]) || 0,     // P: 平均滞在時間
      };
    }
  }

  return null;
}

/**
 * 広告グループ別データを取得
 * @private
 */
function getAdGroupData_(sheet, dateStr) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      result.push({
        groupName: String(data[i][1]) || '',                  // B: グループ名
        cost: parseFloat(data[i][2]) || 0,                    // C: 費用
        impressions: parseInt(data[i][3]) || 0,               // D: 表示回数
        clicks: parseInt(data[i][4]) || 0,                    // E: クリック数
        ctr: parseFloat(data[i][5]) || 0,                     // F: CTR
        avgCpc: parseFloat(data[i][6]) || 0,                  // G: 平均CPC
        conversions: parseInt(data[i][7]) || 0,               // H: CV数
        cvr: parseFloat(data[i][8]) || 0,                     // I: CVR
        cpa: parseFloat(data[i][9]) || 0,                     // J: CPA
      });
    }
  }

  return result;
}

/**
 * キーワード別データを取得
 * @private
 */
function getKeywordData_(sheet, dateStr) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      result.push({
        keyword: String(data[i][1]) || '',                    // B: キーワード
        adGroup: String(data[i][2]) || '',                    // C: 広告グループ
        matchType: String(data[i][3]) || '',                  // D: マッチタイプ
        cost: parseFloat(data[i][4]) || 0,                    // E: 費用
        impressions: parseInt(data[i][5]) || 0,               // F: 表示回数
        clicks: parseInt(data[i][6]) || 0,                    // G: クリック数
        ctr: parseFloat(data[i][7]) || 0,                     // H: CTR
        avgCpc: parseFloat(data[i][8]) || 0,                  // I: 平均CPC
        conversions: parseInt(data[i][9]) || 0,               // J: CV数
      });
    }
  }

  return result;
}

/**
 * GA4流入元データを取得
 * @private
 */
function getGA4SourceData_(sheet, dateStr) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      result.push({
        source: String(data[i][1]) || '',                     // B: 流入元
        sessions: parseInt(data[i][2]) || 0,                  // C: セッション
        users: parseInt(data[i][3]) || 0,                     // D: ユーザー
        engagementRate: parseFloat(data[i][4]) || 0,          // E: エンゲージメント率
        avgSessionDuration: parseFloat(data[i][5]) || 0,      // F: 平均滞在時間
        eventCount: parseInt(data[i][6]) || 0,                // G: イベント数
        conversions: parseInt(data[i][7]) || 0,               // H: CV数
      });
    }
  }

  return result;
}

/**
 * Search Consoleデータを取得
 * @private
 */
function getSearchConsoleData_(sheet, dateStr) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      result.push({
        query: String(data[i][1]) || '',                      // B: クエリ
        impressions: parseInt(data[i][2]) || 0,               // C: 表示回数
        clicks: parseInt(data[i][3]) || 0,                    // D: クリック数
        ctr: parseFloat(data[i][4]) || 0,                     // E: CTR
        position: parseFloat(data[i][5]) || 0,                // F: 掲載順位
      });
    }
  }

  return result;
}

/**
 * Clarityデータを取得
 * @private
 */
function getClarityData_(sheet, dateStr) {
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      return {
        sessions: parseInt(data[i][1]) || 0,                  // B: セッション
        scrollDepth: parseFloat(data[i][2]) || 0,             // C: スクロール深度
        rageClickRate: parseFloat(data[i][3]) || 0,           // D: レイジクリック率
        deadClickRate: parseFloat(data[i][4]) || 0,           // E: デッドクリック率
      };
    }
  }

  return null;
}

/**
 * LINE友だちデータを取得
 * @private
 */
function getLineData_(sheet, dateStr) {
  if (!sheet) return null;

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      return {
        friends: parseInt(data[i][1]) || 0,                   // B: 友だち数
        targetReach: parseInt(data[i][2]) || 0,               // C: ターゲットリーチ
        blocks: parseInt(data[i][3]) || 0,                    // D: ブロック数
      };
    }
  }

  return null;
}

/**
 * アラートログを取得
 * @private
 */
function getAlertData_(sheet, dateStr) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const result = [];

  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (rowDate === dateStr) {
      result.push({
        date: rowDate,
        metric: String(data[i][1]) || '',                     // B: 指標名
        currentValue: parseFloat(data[i][2]) || 0,            // C: 現在値
        threshold: parseFloat(data[i][3]) || 0,               // D: 閾値
        level: String(data[i][4]) || 'info',                  // E: レベル
        message: String(data[i][5]) || '',                    // F: メッセージ
      });
    }
  }

  return result;
}

/**
 * 過去7日間のトレンドデータを取得
 * @private
 */
function getTrendData_(sheet) {
  if (!sheet) return [];

  const data = sheet.getDataRange().getValues();
  const trendMap = {};

  // すべての日付を集約
  for (let i = 1; i < data.length; i++) {
    const rowDate = formatRowDate_(data[i][0]);
    if (!rowDate || !rowDate.match(/^\d{4}-\d{2}-\d{2}$/)) continue;

    trendMap[rowDate] = {
      date: rowDate,
      cost: parseFloat(data[i][1]) || 0,
      clicks: parseInt(data[i][3]) || 0,
      conversions: parseInt(data[i][6]) || 0,
    };
  }

  // ソートして最新の7日間を取得
  const sortedDates = Object.keys(trendMap).sort().reverse();
  const lastSeven = sortedDates.slice(0, 7).reverse();

  return lastSeven.map(date => trendMap[date]);
}

/**
 * 行の日付をフォーマット
 * @private
 */
function formatRowDate_(dateValue) {
  if (!dateValue) return null;

  if (dateValue instanceof Date) {
    return Utilities.formatDate(dateValue, 'Asia/Tokyo', 'yyyy-MM-dd');
  }

  const str = String(dateValue);
  if (str.match(/^\d{4}-\d{2}-\d{2}$/)) {
    return str;
  }

  return null;
}
