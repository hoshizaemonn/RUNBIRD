/**
 * ============================================================
 * 08_alerts.gs - アラート自動判定 + メール通知
 * ============================================================
 */

/**
 * アラート判定を実行
 */
function runAlertCheck() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const yesterday = getYesterdayDate_();

  const summarySheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const alertSheet = ss.getSheetByName(CONFIG.SHEETS.ALERT_LOG);
  const adGroupSheet = ss.getSheetByName(CONFIG.SHEETS.AD_GROUP);

  // 昨日のデータを取得
  const data = getDailySummaryForDate_(summarySheet, yesterday);
  if (!data) {
    Logger.log('アラート判定: ' + yesterday + ' のデータが見つかりません');
    return;
  }

  const alerts = [];
  const now = new Date();
  const timeStr = Utilities.formatDate(now, 'Asia/Tokyo', 'HH:mm:ss');

  // ========== 危険アラート ==========
  // CTR
  if (data.ctr > 0 && data.ctr < BENCHMARKS.CTR.danger) {
    alerts.push({
      type: '危険', metric: 'CTR',
      value: (data.ctr * 100).toFixed(2) + '%',
      threshold: (BENCHMARKS.CTR.danger * 100) + '%未満',
      action: '広告文の見直しが必要です。CTR 4%未満は業界下限を下回っています。'
    });
  }

  // CPC
  if (data.avgCpc > BENCHMARKS.CPC.danger) {
    alerts.push({
      type: '危険', metric: 'CPC',
      value: '¥' + Math.round(data.avgCpc),
      threshold: '¥' + BENCHMARKS.CPC.danger + '超',
      action: '入札単価を確認してください。除外KWの追加でCPC改善が見込めます。'
    });
  }

  // CVR
  if (data.clicks >= 10 && data.cvr < BENCHMARKS.CVR.danger) {
    alerts.push({
      type: '危険', metric: 'CVR',
      value: (data.cvr * 100).toFixed(2) + '%',
      threshold: (BENCHMARKS.CVR.danger * 100) + '%未満',
      action: 'LPの改善が必要です。CTAの位置やLINEボタンのデザインを見直してください。'
    });
  }

  // CPA
  if (data.conversions > 0 && data.cpa > BENCHMARKS.CPA.danger) {
    alerts.push({
      type: '危険', metric: 'CPA',
      value: '¥' + Math.round(data.cpa),
      threshold: '¥' + BENCHMARKS.CPA.danger + '超',
      action: '費用対効果が悪化しています。除外KWとCPC改善を進めてください。'
    });
  }

  // 予算超過
  if (data.budgetRate > BENCHMARKS.BUDGET_RATE.dangerHigh) {
    alerts.push({
      type: '危険', metric: '予算消化率',
      value: (data.budgetRate * 100).toFixed(1) + '%',
      threshold: '120%超',
      action: '予算超過の可能性があります。日予算設定を確認してください。'
    });
  }

  // ========== 注意アラート ==========
  // CTR 注意
  if (data.ctr >= BENCHMARKS.CTR.danger && data.ctr < BENCHMARKS.CTR.warning) {
    alerts.push({
      type: '注意', metric: 'CTR',
      value: (data.ctr * 100).toFixed(2) + '%',
      threshold: (BENCHMARKS.CTR.warning * 100) + '%未満',
      action: '業界平均を下回っています。広告文のA/Bテストを検討してください。'
    });
  }

  // CPC 注意
  if (data.avgCpc > BENCHMARKS.CPC.warning && data.avgCpc <= BENCHMARKS.CPC.danger) {
    alerts.push({
      type: '注意', metric: 'CPC',
      value: '¥' + Math.round(data.avgCpc),
      threshold: '¥' + BENCHMARKS.CPC.warning + '超',
      action: 'CPCが高めです。競合除外KWの追加を検討してください。'
    });
  }

  // 予算未消化
  if (data.budgetRate > 0 && data.budgetRate < BENCHMARKS.BUDGET_RATE.dangerLow) {
    alerts.push({
      type: '注意', metric: '予算消化率',
      value: (data.budgetRate * 100).toFixed(1) + '%',
      threshold: '50%未満',
      action: '予算が使い切れていません。キーワード追加や入札引き上げを検討してください。'
    });
  }

  // GR別チェック（表示0のグループ）
  const adGroupData = getAdGroupDataForDate_(adGroupSheet, yesterday);
  adGroupData.forEach(ag => {
    if (ag.impressions === 0) {
      alerts.push({
        type: '注意', metric: '広告グループ',
        value: ag.name + ': 表示0',
        threshold: '表示回数0',
        action: ag.name + ' のキーワードバリエーション追加を検討してください。'
      });
    }
  });

  // ========== 好調指標 ==========
  if (data.ctr >= BENCHMARKS.CTR.good) {
    alerts.push({
      type: '好調', metric: 'CTR',
      value: (data.ctr * 100).toFixed(2) + '%',
      threshold: (BENCHMARKS.CTR.good * 100) + '%以上',
      action: 'CTRが業界上位レベルです。広告文が効果的に機能しています。'
    });
  }

  if (data.conversions > 0) {
    alerts.push({
      type: '好調', metric: 'CV',
      value: data.conversions + '件',
      threshold: '1件以上',
      action: 'コンバージョンが発生しました！'
    });
  }

  // ========== アラートをシートに記録 ==========
  alerts.forEach(alert => {
    alertSheet.appendRow([
      yesterday, timeStr, alert.type, alert.metric,
      alert.value, alert.threshold, alert.action
    ]);
  });

  // 日次サマリーのアラート列にサマリーを書き込み
  const alertSummary = alerts
    .filter(a => a.type !== '好調')
    .map(a => a.metric + ':' + a.type)
    .join(', ') || 'OK';
  const row = findOrCreateRow_(summarySheet, yesterday);
  sheet_getRange_safe_(summarySheet, row, 21).setValue(alertSummary);

  Logger.log('アラート判定完了: ' + alerts.length + '件');

  // メール通知
  if (CONFIG.NOTIFICATION.SEND_DAILY_REPORT) {
    sendAlertEmail_(yesterday, data, alerts);
  }

  return alerts;
}

/**
 * 日次レポートメールを送信
 */
function sendDailyReport() {
  const yesterday = getYesterdayDate_();
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const summarySheet = ss.getSheetByName(CONFIG.SHEETS.DAILY_SUMMARY);
  const data = getDailySummaryForDate_(summarySheet, yesterday);

  if (!data) {
    Logger.log('メール送信: データなし');
    return;
  }

  const alerts = runAlertCheck();
  sendAlertEmail_(yesterday, data, alerts || []);
}

function sendAlertEmail_(date, data, alerts) {
  const dangerAlerts = alerts.filter(a => a.type === '危険');
  const warningAlerts = alerts.filter(a => a.type === '注意');
  const goodAlerts = alerts.filter(a => a.type === '好調');

  let subject = '【ニコニコカーローン】日次レポート ' + date;
  if (dangerAlerts.length > 0) {
    subject = '🔴【緊急】' + subject + ' (' + dangerAlerts.length + '件の危険アラート)';
  } else if (warningAlerts.length > 0) {
    subject = '🟡 ' + subject;
  } else {
    subject = '🟢 ' + subject;
  }

  let body = '';
  body += '━━━━━━━━━━━━━━━━━━━━━━━\n';
  body += '  ニコニコカーローン 日次レポート\n';
  body += '  ' + date + '\n';
  body += '━━━━━━━━━━━━━━━━━━━━━━━\n\n';

  body += '【KPIサマリー】\n';
  body += '  費用: ¥' + (data.cost || 0).toLocaleString() + '\n';
  body += '  表示回数: ' + (data.impressions || 0).toLocaleString() + '\n';
  body += '  クリック数: ' + (data.clicks || 0) + '\n';
  body += '  CTR: ' + ((data.ctr || 0) * 100).toFixed(2) + '%\n';
  body += '  CPC: ¥' + Math.round(data.avgCpc || 0) + '\n';
  body += '  CV: ' + (data.conversions || 0) + '件\n';
  body += '  CVR: ' + ((data.cvr || 0) * 100).toFixed(2) + '%\n';
  body += '  CPA: ¥' + Math.round(data.cpa || 0) + '\n';
  body += '  予算消化率: ' + ((data.budgetRate || 0) * 100).toFixed(1) + '%\n\n';

  if (dangerAlerts.length > 0) {
    body += '🔴【危険アラート】\n';
    dangerAlerts.forEach(a => {
      body += '  ・' + a.metric + ': ' + a.value + '\n';
      body += '    → ' + a.action + '\n';
    });
    body += '\n';
  }

  if (warningAlerts.length > 0) {
    body += '🟡【注意アラート】\n';
    warningAlerts.forEach(a => {
      body += '  ・' + a.metric + ': ' + a.value + '\n';
      body += '    → ' + a.action + '\n';
    });
    body += '\n';
  }

  if (goodAlerts.length > 0) {
    body += '🟢【好調指標】\n';
    goodAlerts.forEach(a => {
      body += '  ・' + a.metric + ': ' + a.value + ' ' + a.action + '\n';
    });
    body += '\n';
  }

  body += '━━━━━━━━━━━━━━━━━━━━━━━\n';
  body += 'スプレッドシート: https://docs.google.com/spreadsheets/d/' + CONFIG.SPREADSHEET_ID + '\n';

  MailApp.sendEmail({
    to: CONFIG.NOTIFICATION.EMAIL,
    subject: subject,
    body: body,
  });

  Logger.log('日次レポートメール送信完了: ' + CONFIG.NOTIFICATION.EMAIL);
}

/**
 * 日次サマリーシートから指定日のデータを取得
 */
function getDailySummaryForDate_(sheet, date) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    const formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) {
      return {
        cost: data[i][1] || 0,
        impressions: data[i][2] || 0,
        clicks: data[i][3] || 0,
        ctr: data[i][4] || 0,
        avgCpc: data[i][5] || 0,
        conversions: data[i][6] || 0,
        cvr: data[i][7] || 0,
        cpa: data[i][8] || 0,
        budgetRate: data[i][9] || 0,
      };
    }
  }
  return null;
}

function getAdGroupDataForDate_(sheet, date) {
  const data = sheet.getDataRange().getValues();
  const result = [];
  for (let i = 1; i < data.length; i++) {
    const rowDate = data[i][0];
    const formatted = rowDate instanceof Date
      ? Utilities.formatDate(rowDate, 'Asia/Tokyo', 'yyyy-MM-dd')
      : String(rowDate);
    if (formatted === date) {
      result.push({
        name: data[i][1],
        impressions: data[i][3] || 0,
      });
    }
  }
  return result;
}

function sheet_getRange_safe_(sheet, row, col) {
  // シートの列数が足りない場合は拡張
  if (col > sheet.getMaxColumns()) {
    sheet.insertColumnsAfter(sheet.getMaxColumns(), col - sheet.getMaxColumns());
  }
  return sheet.getRange(row, col);
}
