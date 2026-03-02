/**
 * ============================================================
 * 10_main.gs - メイン実行関数
 * ============================================================
 *
 * 毎朝9時のトリガーで実行される関数です。
 * 全データソースからデータを取得し、アラート判定を行います。
 */

/**
 * 全データを取得（メインエントリーポイント）
 * トリガーからこの関数が呼ばれます
 */
function fetchAllData() {
  Logger.log('========== 全データ取得開始 ==========');
  Logger.log('実行日時: ' + new Date().toLocaleString('ja-JP'));

  const results = {
    googleAds: false,
    ga4: false,
    searchConsole: false,
    line: false,
    clarity: false,
    alerts: false,
  };

  // 1. Google広告データ
  try {
    Logger.log('\n--- Google広告データ取得 ---');
    fetchGoogleAdsData();
    results.googleAds = true;
  } catch (e) {
    Logger.log('Google広告エラー: ' + e.message);
  }

  // 2. GA4データ
  try {
    Logger.log('\n--- GA4データ取得 ---');
    fetchGA4Data();
    results.ga4 = true;
  } catch (e) {
    Logger.log('GA4エラー: ' + e.message);
  }

  // 3. Search Consoleデータ
  try {
    Logger.log('\n--- Search Consoleデータ取得 ---');
    fetchSearchConsoleData();
    results.searchConsole = true;
  } catch (e) {
    Logger.log('Search Consoleエラー: ' + e.message);
  }

  // 4. LINEデータ
  try {
    Logger.log('\n--- LINEデータ取得 ---');
    fetchLINEData();
    results.line = true;
  } catch (e) {
    Logger.log('LINEエラー: ' + e.message);
  }

  // 5. Clarityデータ
  try {
    Logger.log('\n--- Clarityデータ取得 ---');
    fetchClarityData();
    results.clarity = true;
  } catch (e) {
    Logger.log('Clarityエラー: ' + e.message);
  }

  // 6. アラート判定
  try {
    Logger.log('\n--- アラート判定 ---');
    runAlertCheck();
    results.alerts = true;
  } catch (e) {
    Logger.log('アラート判定エラー: ' + e.message);
  }

  // 7. ダッシュボードJSON構築 & GitHub push
  try {
    Logger.log('\n--- ダッシュボードJSON構築 & GitHub push ---');
    exportAndDeploy();
    results.export = true;
  } catch (e) {
    Logger.log('GitHub Exportエラー: ' + e.message);
    results.export = false;
  }

  // 結果サマリー
  Logger.log('\n========== 取得結果 ==========');
  Logger.log('Google広告: ' + (results.googleAds ? '成功' : '失敗'));
  Logger.log('GA4: ' + (results.ga4 ? '成功' : '失敗'));
  Logger.log('Search Console: ' + (results.searchConsole ? '成功' : '失敗'));
  Logger.log('LINE: ' + (results.line ? '成功' : '失敗'));
  Logger.log('Clarity: ' + (results.clarity ? '成功' : '失敗'));
  Logger.log('アラート判定: ' + (results.alerts ? '成功' : '失敗'));
  Logger.log('GitHub Export: ' + (results.export ? '成功' : '失敗'));
  Logger.log('========== 完了 ==========');
}

/**
 * appsscript.json のスコープ設定
 * GASエディタ > プロジェクト設定 > 「appsscript.json」マニフェストをエディタに表示
 * → 以下のスコープを追加:
 *
 * {
 *   "timeZone": "Asia/Tokyo",
 *   "dependencies": {},
 *   "exceptionLogging": "STACKDRIVER",
 *   "runtimeVersion": "V8",
 *   "oauthScopes": [
 *     "https://www.googleapis.com/auth/spreadsheets",
 *     "https://www.googleapis.com/auth/analytics.readonly",
 *     "https://www.googleapis.com/auth/webmasters.readonly",
 *     "https://www.googleapis.com/auth/script.external_request",
 *     "https://www.googleapis.com/auth/script.send_mail"
 *   ]
 * }
 */
