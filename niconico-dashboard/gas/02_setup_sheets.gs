/**
 * ============================================================
 * 02_setup_sheets.gs - スプレッドシート自動セットアップ
 * ============================================================
 *
 * メニューから「初期セットアップ」を実行すると、
 * 全シートのヘッダーとフォーマットが自動作成されます。
 */

/**
 * カスタムメニューを追加
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('ニコニコダッシュボード')
    .addItem('初期セットアップ（シート作成）', 'setupAllSheets')
    .addSeparator()
    .addItem('手動実行: 全データ取得', 'fetchAllData')
    .addItem('手動実行: Google広告のみ', 'fetchGoogleAdsData')
    .addItem('手動実行: GA4のみ', 'fetchGA4Data')
    .addItem('手動実行: Search Consoleのみ', 'fetchSearchConsoleData')
    .addItem('手動実行: LINEのみ', 'fetchLINEData')
    .addItem('手動実行: Clarityのみ', 'fetchClarityData')
    .addSeparator()
    .addItem('アラート判定 実行', 'runAlertCheck')
    .addItem('日次レポートメール送信', 'sendDailyReport')
    .addSeparator()
    .addItem('毎朝9時トリガー設定', 'createDailyTrigger')
    .addItem('トリガー全削除', 'deleteAllTriggers')
    .addToUi();
}

/**
 * 全シートを初期セットアップ
 */
function setupAllSheets() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);

  // 日次サマリー
  setupSheet_(ss, CONFIG.SHEETS.DAILY_SUMMARY, [
    '日付', '費用', '表示回数', 'クリック数', 'CTR', '平均CPC',
    'CV数', 'CVR', 'CPA', '予算消化率',
    'LINE友だち追加', 'LINE累計友だち',
    'GA4セッション', 'GA4ユーザー', 'エンゲージメント率', '平均滞在時間(秒)',
    'SC表示回数', 'SCクリック', 'SC CTR', 'SC平均順位',
    'アラート'
  ]);

  // 広告グループ別
  setupSheet_(ss, CONFIG.SHEETS.AD_GROUP, [
    '日付', '広告グループ', '費用', '表示回数', 'クリック数',
    'CTR', '平均CPC', 'CV数', 'CVR', 'CPA'
  ]);

  // キーワード別
  setupSheet_(ss, CONFIG.SHEETS.KEYWORDS, [
    '日付', 'キーワード', '広告グループ', 'マッチタイプ',
    '費用', '表示回数', 'クリック数', 'CTR', '平均CPC', 'CV数'
  ]);

  // 検索語句
  setupSheet_(ss, CONFIG.SHEETS.SEARCH_TERMS, [
    '日付', '検索語句', '費用', 'クリック数', '表示回数'
  ]);

  // 時間帯別
  setupSheet_(ss, CONFIG.SHEETS.HOURLY, [
    '日付', '時間帯', 'クリック数', '表示回数', '平均CPC', '費用'
  ]);

  // デバイス別
  setupSheet_(ss, CONFIG.SHEETS.DEVICES, [
    '日付', 'デバイス', '費用', '表示回数', 'クリック数'
  ]);

  // ネットワーク別
  setupSheet_(ss, CONFIG.SHEETS.NETWORK, [
    '日付', 'ネットワーク', 'クリック数', '費用', '平均CPC'
  ]);

  // 性別
  setupSheet_(ss, CONFIG.SHEETS.GENDER, [
    '日付', '性別', '表示回数', '割合(%)'
  ]);

  // 年齢
  setupSheet_(ss, CONFIG.SHEETS.AGE, [
    '日付', '年齢範囲', '表示回数', '割合(%)'
  ]);

  // GA4データ
  setupSheet_(ss, CONFIG.SHEETS.GA4_DATA, [
    '日付', '参照元/メディア', 'セッション', 'ユーザー',
    'エンゲージメント率', '平均セッション時間(秒)',
    'イベント数', 'コンバージョン'
  ]);

  // GA4ページ
  setupSheet_(ss, CONFIG.SHEETS.GA4_PAGES, [
    '日付', 'ページパス', '参照元/メディア', '表示回数',
    'アクティブユーザー', 'エンゲージメント時間(秒)', 'イベント数'
  ]);

  // Search Console
  setupSheet_(ss, CONFIG.SHEETS.SEARCH_CONSOLE, [
    '日付', 'クエリ', '表示回数', 'クリック数', 'CTR', '平均掲載順位'
  ]);

  // Clarity
  setupSheet_(ss, CONFIG.SHEETS.CLARITY, [
    '日付', 'セッション数', 'スクロール深度(%)', '怒りクリック率(%)',
    'デッドクリック率(%)', '平均スクロール深度(%)', 'エクセシブスクロール率(%)'
  ]);

  // LINE友だち
  setupSheet_(ss, CONFIG.SHEETS.LINE_FRIENDS, [
    '日付', '友だち追加数', 'ブロック数', '合計友だち数',
    'ターゲットリーチ', 'メッセージ配信数'
  ]);

  // ベンチマーク
  const benchSheet = setupSheet_(ss, CONFIG.SHEETS.BENCHMARK, [
    '指標', '業界下限(危険)', '業界平均', '業界上位(目標)', 'アラート条件'
  ]);
  // ベンチマークデータを入力
  const benchData = [
    ['CTR', '4.0%', '6.0〜8.0%', '10%+', '4%未満で危険 / 6%未満で注意'],
    ['CPC', '¥600超', '¥300〜500', '¥200以下', '¥600超で危険 / ¥400超で注意'],
    ['CVR', '2.0%', '4.0〜6.0%', '8%+', '2%未満で危険 / 4%未満で注意'],
    ['CPA', '¥15,000超', '¥5,000〜10,000', '¥5,000以下', '¥15,000超で危険 / ¥10,000超で注意'],
    ['日予算消化率', '50%未満', '80〜100%', '90〜100%', '50%未満 or 120%超で警告'],
    ['直帰率', '70%超', '50〜65%', '40%以下', '70%超で危険'],
    ['平均滞在時間', '30秒未満', '1分〜2分30秒', '3分+', '30秒未満で危険'],
    ['スクロール50%到達率', '40%未満', '50〜65%', '70%+', '40%未満で危険'],
    ['LINE登録率', '50%未満', '60〜75%', '80%+', '50%未満で危険'],
  ];
  if (benchSheet.getLastRow() <= 1) {
    benchSheet.getRange(2, 1, benchData.length, benchData[0].length).setValues(benchData);
  }

  // アラートログ
  setupSheet_(ss, CONFIG.SHEETS.ALERT_LOG, [
    '日付', '時刻', 'アラート種別', '指標', '実績値', '基準値', '推奨アクション'
  ]);

  SpreadsheetApp.getUi().alert('セットアップが完了しました！\n全17シートが作成されました。');
}

/**
 * シートを作成してヘッダーを設定するヘルパー
 */
function setupSheet_(ss, sheetName, headers) {
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
  }
  // ヘッダー行が空なら設定
  if (sheet.getRange(1, 1).getValue() === '') {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    // ヘッダーのフォーマット
    const headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setBackground('#f1f3f4');
    headerRange.setFontWeight('bold');
    headerRange.setFontSize(10);
    sheet.setFrozenRows(1);
    // 列幅の自動調整
    for (let i = 1; i <= headers.length; i++) {
      sheet.autoResizeColumn(i);
    }
  }
  return sheet;
}

/**
 * 毎朝9時のトリガーを設定
 */
function createDailyTrigger() {
  // 既存のトリガーを確認
  const triggers = ScriptApp.getProjectTriggers();
  const existingTrigger = triggers.find(t => t.getHandlerFunction() === 'fetchAllData');
  if (existingTrigger) {
    SpreadsheetApp.getUi().alert('既に毎朝9時のトリガーが設定されています。');
    return;
  }

  ScriptApp.newTrigger('fetchAllData')
    .timeBased()
    .everyDays(1)
    .atHour(9)
    .create();

  SpreadsheetApp.getUi().alert(
    '毎朝9時のトリガーを設定しました。\n' +
    '毎朝自動で全データが取得されます。'
  );
}

/**
 * 全トリガーを削除
 */
function deleteAllTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => ScriptApp.deleteTrigger(trigger));
  SpreadsheetApp.getUi().alert('全トリガーを削除しました。');
}
