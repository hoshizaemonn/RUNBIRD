/**
 * ============================================================
 * 12_export_github.gs - ダッシュボードJSON構築 & GitHub Push
 * ============================================================
 *
 * 全Sheetからデータを読み取り、data/*.json と同じスキーマの
 * JSONオブジェクトを構築し、GitHub Contents API で push します。
 *
 * セットアップ:
 * 1. Script Properties に GITHUB_TOKEN を設定
 *    PropertiesService.getScriptProperties().setProperty('GITHUB_TOKEN', 'ghp_...')
 * 2. トークンには repo 権限が必要
 */

/**
 * Sheetの全データを読み取り、指定日の行だけ抽出するヘルパー
 * @param {Sheet} sheet
 * @param {string} date - 'yyyy-MM-dd'
 * @returns {Array<Array>} マッチした行（ヘッダーなし）
 */
function getRowsForDate_(sheet, date) {
  if (!sheet) return [];
  const data = sheet.getDataRange().getValues();
  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    const formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) {
      rows.push(data[i]);
    }
  }
  return rows;
}

/**
 * 全Sheetからデータを読み取り、dashboard JSON を構築
 * @param {string} dateStr - 'yyyy-MM-dd'
 * @returns {Object} data/*.json と同じスキーマのオブジェクト
 */
function buildDashboardJSON(dateStr) {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const date = new Date(dateStr + 'T00:00:00+09:00');
  const day = date.getDate();

  // ---- 日次サマリー ----
  const summarySheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const summaryRows = getRowsForDate_(summarySheet, dateStr);
  const s = summaryRows[0] || [];
  // columns: 日付,費用,表示回数,クリック数,CTR,平均CPC,CV数,CVR,CPA,予算消化率,...

  const campaign = {
    name: CONFIG.GOOGLE_ADS.CAMPAIGN_NAME + '_検索',
    cost: Number(s[1]) || 0,
    impressions: Number(s[2]) || 0,
    clicks: Number(s[3]) || 0,
    ctr: Number(s[4]) || 0,
    cpc: Number(s[5]) || 0,
    cv: Number(s[6]) || 0,
    cvr: Number(s[7]) || 0,
    cpa: Number(s[8]) || 0,
    optimization_score: 0,
  };

  // ---- 広告グループ別 ----
  const agSheet = ss.getSheetByName(CONFIG.SHEETS.AD_GROUP);
  const agRows = getRowsForDate_(agSheet, dateStr);
  const groups = agRows.map(r => ({
    name: String(r[1]),
    cost: Number(r[2]) || 0,
    impressions: Number(r[3]) || 0,
    clicks: Number(r[4]) || 0,
    ctr: Number(r[5]) || 0,
    cpc: Number(r[6]) || 0,
    cv: Number(r[7]) || 0,
    cvr: Number(r[8]) || 0,
    cpa: Number(r[9]) || 0,
  }));
  const adgroups = groups.length > 0 ? {
    groups: groups,
    total: {
      impressions: campaign.impressions,
      ctr: campaign.ctr,
      cost: campaign.cost,
      clicks: campaign.clicks,
      cvr: campaign.cvr,
      cv: campaign.cv,
      cpc: campaign.cpc,
      cpa: campaign.cpa,
    },
  } : null;

  // ---- キーワード別 ----
  const kwSheet = ss.getSheetByName(CONFIG.SHEETS.KEYWORDS);
  const kwRows = getRowsForDate_(kwSheet, dateStr);
  const keywords = kwRows.length > 0 ? kwRows.map(r => ({
    keyword: String(r[1]),
    match_type: String(r[3]),
    cost: Number(r[4]) || 0,
    clicks: Number(r[6]) || 0,
    ctr: Number(r[7]) || 0,
  })) : null;

  // ---- 検索語句 ----
  const stSheet = ss.getSheetByName(CONFIG.SHEETS.SEARCH_TERMS);
  const stRows = getRowsForDate_(stSheet, dateStr);
  const search_terms = stRows.length > 0 ? stRows.map(r => ({
    term: String(r[1]),
    cost: Number(r[2]) || 0,
    clicks: Number(r[3]) || 0,
    impressions: Number(r[4]) || 0,
  })) : null;

  // ---- 時間帯別 ----
  const hourlySheet = ss.getSheetByName(CONFIG.SHEETS.HOURLY);
  const hourlyRows = getRowsForDate_(hourlySheet, dateStr);
  const hourly = hourlyRows.length > 0 ? hourlyRows.map(r => ({
    hour: String(r[1]),
    clicks: Number(r[2]) || 0,
    impressions: Number(r[3]) || 0,
    cpc: Number(r[4]) || 0,
    cost: Number(r[5]) || 0,
  })) : null;

  // ---- デバイス別 ----
  const devSheet = ss.getSheetByName(CONFIG.SHEETS.DEVICES);
  const devRows = getRowsForDate_(devSheet, dateStr);
  const devices = devRows.length > 0 ? devRows.map(r => ({
    device: String(r[1]),
    cost: Number(r[2]) || 0,
    impressions: Number(r[3]) || 0,
    clicks: Number(r[4]) || 0,
  })) : null;

  // ---- ネットワーク別 ----
  const netSheet = ss.getSheetByName(CONFIG.SHEETS.NETWORK);
  const netRows = getRowsForDate_(netSheet, dateStr);
  const network = netRows.length > 0 ? netRows.map(r => ({
    network: String(r[1]),
    clicks: Number(r[2]) || 0,
    cost: Number(r[3]) || 0,
    cpc: Number(r[4]) || 0,
  })) : null;

  // ---- 性別 ----
  const genderSheet = ss.getSheetByName(CONFIG.SHEETS.GENDER);
  const genderRows = getRowsForDate_(genderSheet, dateStr);
  const gender = genderRows.length > 0 ? genderRows.map(r => ({
    gender: String(r[1]),
    impressions: Number(r[2]) || 0,
    pct: Number(r[3]) || 0,
  })) : null;

  // ---- 年齢 ----
  const ageSheet = ss.getSheetByName(CONFIG.SHEETS.AGE);
  const ageRows = getRowsForDate_(ageSheet, dateStr);
  const age = ageRows.length > 0 ? ageRows.map(r => ({
    age_range: String(r[1]),
    impressions: Number(r[2]) || 0,
    pct: Number(r[3]) || 0,
  })) : null;

  // ---- Clarity ----
  const claritySheet = ss.getSheetByName(CONFIG.SHEETS.CLARITY);
  const clarityRows = getRowsForDate_(claritySheet, dateStr);
  let clarity = null;
  if (clarityRows.length > 0) {
    const cr = clarityRows[0];
    clarity = {
      sessions: Number(cr[1]) || 0,
      scroll_depth: Math.round((Number(cr[5]) || 0) * 10) / 10,
      unique_users: Number(cr[1]) || 0,
      rage_clicks: { count: 0, pct: Math.round((Number(cr[3]) || 0) * 100) / 100 },
      dead_clicks: { count: 0, pct: Math.round((Number(cr[4]) || 0) * 100) / 100 },
    };
  }

  // ---- GA4ページ ----
  const ga4Sheet = ss.getSheetByName(CONFIG.SHEETS.GA4_PAGES);
  const ga4Rows = getRowsForDate_(ga4Sheet, dateStr);
  let ga4_pages = null;
  if (ga4Rows.length > 0) {
    // Aggregate by path
    const pathMap = {};
    ga4Rows.forEach(r => {
      const path = String(r[1]);
      const source = String(r[2]);
      const views = Number(r[3]) || 0;
      const users = Number(r[4]) || 0;
      const engTime = Number(r[5]) || 0;
      const events = Number(r[6]) || 0;
      if (!pathMap[path]) {
        pathMap[path] = { path: path, views: 0, active_users: 0, total_engagement: 0, events: 0, sources: [] };
      }
      const pt = pathMap[path];
      pt.views += views;
      pt.active_users += users;
      pt.total_engagement += engTime * users;
      pt.events += events;
      if (source && views > 0) {
        pt.sources.push({ source: source, views: views, users: users });
      }
    });
    ga4_pages = Object.values(pathMap).map(pt => {
      pt.avg_engagement = pt.active_users > 0 ? Math.round(pt.total_engagement / pt.active_users * 10) / 10 : 0;
      delete pt.total_engagement;
      pt.sources.sort((a, b) => b.views - a.views);
      return pt;
    });
    ga4_pages.sort((a, b) => b.views - a.views);
  }

  return {
    date: dateStr,
    tab_key: String(day),
    campaign: campaign,
    adgroups: adgroups,
    keywords: keywords,
    search_terms: search_terms,
    hourly: hourly,
    devices: devices,
    network: network,
    gender: gender,
    age: age,
    clarity: clarity,
    clarity_scroll: null,
    ga4_pages: ga4_pages,
  };
}

/**
 * GitHub Contents API でファイルを push（作成 or 更新）
 * @param {string} path - リポジトリ内のファイルパス (例: 'data/2026-03-01.json')
 * @param {string} content - ファイル内容
 * @param {string} commitMessage - コミットメッセージ
 */
function pushFileToGitHub(path, content, commitMessage) {
  const token = PropertiesService.getScriptProperties().getProperty(CONFIG.GITHUB.TOKEN_PROPERTY);
  if (!token) {
    throw new Error('GITHUB_TOKEN が Script Properties に設定されていません');
  }

  const apiUrl = 'https://api.github.com/repos/' +
    CONFIG.GITHUB.OWNER + '/' + CONFIG.GITHUB.REPO +
    '/contents/' + path;

  const headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'GAS-NiconicoDashboard',
  };

  // 既存ファイルの sha を取得（更新時に必要）
  let sha = null;
  try {
    const getResp = UrlFetchApp.fetch(apiUrl + '?ref=' + CONFIG.GITHUB.BRANCH, {
      method: 'get',
      headers: headers,
      muteHttpExceptions: true,
    });
    if (getResp.getResponseCode() === 200) {
      sha = JSON.parse(getResp.getContentText()).sha;
    }
  } catch (e) {
    Logger.log('既存ファイル取得スキップ: ' + e.message);
  }

  // PUT でファイル作成/更新
  const payload = {
    message: commitMessage,
    content: Utilities.base64Encode(content, Utilities.Charset.UTF_8),
    branch: CONFIG.GITHUB.BRANCH,
  };
  if (sha) {
    payload.sha = sha;
  }

  const putResp = UrlFetchApp.fetch(apiUrl, {
    method: 'put',
    headers: headers,
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });

  const code = putResp.getResponseCode();
  if (code !== 200 && code !== 201) {
    throw new Error('GitHub API Error (' + code + '): ' + putResp.getContentText());
  }

  Logger.log('GitHub push 成功: ' + path + ' (' + code + ')');
}

/**
 * ダッシュボードJSONを構築してGitHubにpush
 * メインのエクスポート関数。fetchAllData() の最後で呼ばれる。
 */
function exportAndDeploy() {
  const yesterday = getYesterdayDate_();
  Logger.log('=== exportAndDeploy 開始: ' + yesterday + ' ===');

  // JSON構築
  const data = buildDashboardJSON(yesterday);
  const jsonStr = JSON.stringify(data, null, 2);
  Logger.log('JSON構築完了: ' + jsonStr.length + ' bytes');

  // GitHub push
  const path = 'data/' + yesterday + '.json';
  const message = 'Auto-update: ' + yesterday + ' daily data';
  pushFileToGitHub(path, jsonStr, message);

  Logger.log('=== exportAndDeploy 完了 ===');
}
