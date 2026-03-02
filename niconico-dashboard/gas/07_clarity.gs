/**
 * ============================================================
 * 07_clarity.gs - Microsoft Clarity API データ取得
 * ============================================================
 *
 * Clarity API を使用:
 * - セッション数、スクロール深度、怒りクリック率、デッドクリック率
 *
 * 前提:
 * - Clarity プロジェクトが作成済み（ID: vj3x8hnzco）
 * - Clarity API トークンを取得
 *
 * Clarity API の認証方法:
 * 1. https://clarity.microsoft.com にログイン
 * 2. プロジェクト設定 > API Access
 * 3. API Token を生成
 * 4. Script Properties に保存:
 *    PropertiesService.getScriptProperties().setProperty('CLARITY_API_TOKEN', 'YOUR_TOKEN')
 *
 * 注意: Clarity APIは比較的新しく、エンドポイントが変更される可能性があります。
 * APIが利用不可の場合は手動入力のフォールバック機能も用意しています。
 */

function fetchClarityData() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const yesterday = getYesterdayDate_();

  try {
    const token = PropertiesService.getScriptProperties().getProperty('CLARITY_API_TOKEN');

    if (!token) {
      Logger.log('Clarity: APIトークンが設定されていません。');
      Logger.log('Script Properties に CLARITY_API_TOKEN を設定するか、手動でデータを入力してください。');
      return;
    }

    const clarityData = fetchClarityMetrics_(token, yesterday);
    writeClarityData_(ss, yesterday, clarityData);

    Logger.log('Clarityデータ取得完了: ' + yesterday);
  } catch (e) {
    Logger.log('Clarityデータ取得エラー: ' + e.message);
    logError_('Clarity', e.message);
  }
}

/**
 * Clarity API でメトリクスを取得
 */
function fetchClarityMetrics_(token, date) {
  const projectId = CONFIG.CLARITY.PROJECT_ID;

  // Clarity API v1 エンドポイント
  const url = 'https://www.clarity.ms/api/v1/projects/' + projectId + '/dashboard';

  const response = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
    },
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    // Clarity API がまだ利用不可の場合は代替手段を試みる
    Logger.log('Clarity API応答: ' + response.getResponseCode());

    // GA4連携経由でClarityデータを取得する代替手段
    return fetchClarityViaGA4_(date);
  }

  const result = JSON.parse(response.getContentText());

  return {
    sessions: result.totalSessions || 0,
    scrollDepth: result.averageScrollDepth || 0,
    rageClickRate: result.rageClickRate || 0,
    deadClickRate: result.deadClickRate || 0,
    avgScrollDepth: result.averageScrollDepth || 0,
    excessiveScrollRate: result.excessiveScrollRate || 0,
  };
}

/**
 * 代替: GA4連携経由でClarity相当のデータを取得
 * Clarity → GA4 連携が設定されている場合、GA4のカスタムイベントから取得可能
 */
function fetchClarityViaGA4_(date) {
  try {
    const propertyId = CONFIG.GA4.PROPERTY_ID;
    const url = 'https://analyticsdata.googleapis.com/v1beta/properties/' + propertyId + ':runReport';

    const payload = {
      dateRanges: [{ startDate: date, endDate: date }],
      metrics: [
        { name: 'sessions' },
        { name: 'scrolledUsers' },
        { name: 'activeUsers' },
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

    if (response.getResponseCode() === 200) {
      const result = JSON.parse(response.getContentText());
      if (result.rows && result.rows.length > 0) {
        const values = result.rows[0].metricValues;
        const sessions = parseInt(values[0].value) || 0;
        const scrolledUsers = parseInt(values[1].value) || 0;
        const activeUsers = parseInt(values[2].value) || 0;

        return {
          sessions: sessions,
          scrollDepth: activeUsers > 0 ? (scrolledUsers / activeUsers) * 100 : 0,
          rageClickRate: 0, // GA4では取得不可
          deadClickRate: 0, // GA4では取得不可
          avgScrollDepth: activeUsers > 0 ? (scrolledUsers / activeUsers) * 100 : 0,
          excessiveScrollRate: 0,
        };
      }
    }
  } catch (e) {
    Logger.log('GA4経由のClarity代替取得エラー: ' + e.message);
  }

  // データ取得失敗時は空データ
  return {
    sessions: 0, scrollDepth: 0, rageClickRate: 0,
    deadClickRate: 0, avgScrollDepth: 0, excessiveScrollRate: 0,
  };
}

function writeClarityData_(ss, date, data) {
  const sheet = ss.getSheetByName(CONFIG.SHEETS.CLARITY);
  removeExistingRows_(sheet, date);

  sheet.appendRow([
    date,
    data.sessions,
    data.scrollDepth,
    data.rageClickRate,
    data.deadClickRate,
    data.avgScrollDepth,
    data.excessiveScrollRate,
  ]);
}
