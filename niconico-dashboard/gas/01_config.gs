/**
 * ============================================================
 * ニコニコカーローン 日次ダッシュボード
 * 01_config.gs - 設定ファイル
 * ============================================================
 *
 * このファイルを最初に設定してください。
 * 各APIの認証情報とアカウントIDを入力します。
 */

// ==================== 基本設定 ====================
const CONFIG = {
  // スプレッドシートID（このGASがバインドされているシート）
  SPREADSHEET_ID: '1sFhj5viP_uMap0nqy3M5Y584orGLlvhQWxYU96CWmoI',

  // ==================== Google広告 ====================
  GOOGLE_ADS: {
    CUSTOMER_ID: '7013948182',        // ハイフンなし
    CAMPAIGN_NAME: 'ニコニコカーローン', // キャンペーン名（部分一致で検索）
    DAILY_BUDGET: 15000,               // 日予算（円）
  },

  // ==================== GA4 ====================
  GA4: {
    PROPERTY_ID: '523494769',          // GA4プロパティID
    // GA4 Data API は OAuth2 で認証（GASのスコープで自動対応）
  },

  // ==================== Search Console ====================
  SEARCH_CONSOLE: {
    SITE_URL: 'https://relief-trust.com',  // サイトURL
  },

  // ==================== Microsoft Clarity ====================
  CLARITY: {
    PROJECT_ID: 'vj3x8hnzco',
    // Clarity API Token は Script Properties に保存
    // PropertiesService.getScriptProperties().setProperty('CLARITY_API_TOKEN', 'your-token')
  },

  // ==================== LINE公式アカウント ====================
  LINE: {
    // チャネルアクセストークンは Script Properties に保存
    // PropertiesService.getScriptProperties().setProperty('LINE_CHANNEL_TOKEN', 'your-token')
  },

  // ==================== 通知設定 ====================
  NOTIFICATION: {
    EMAIL: 'andan.39.2106@gmail.com',  // アラート通知先メール
    SEND_DAILY_REPORT: true,            // 毎朝のサマリーメールを送るか
  },

  // ==================== GitHub ====================
  GITHUB: {
    OWNER: 'hoshizaemonn',
    REPO: 'RUNBIRD',
    BRANCH: 'gh-pages-clean',
    TOKEN_PROPERTY: 'GITHUB_TOKEN',  // Script Properties のキー名
  },

  // ==================== シート名 ====================
  SHEETS: {
    DAILY_SUMMARY: '日次サマリー',
    AD_GROUP: '広告グループ別',
    KEYWORDS: 'キーワード別',
    SEARCH_TERMS: '検索語句',
    HOURLY: '時間帯別',
    DEVICES: 'デバイス別',
    NETWORK: 'ネットワーク別',
    GENDER: '性別',
    AGE: '年齢',
    GA4_DATA: 'GA4データ',
    GA4_PAGES: 'GA4ページ',
    SEARCH_CONSOLE: 'Search Console',
    CLARITY: 'Clarity',
    LINE_FRIENDS: 'LINE友だち',
    BENCHMARK: 'ベンチマーク',
    ALERT_LOG: 'アラートログ',
  },
};

// ==================== 業界ベンチマーク ====================
const BENCHMARKS = {
  CTR: {
    danger: 0.04,    // 4%未満で危険
    warning: 0.06,   // 6%未満で注意
    average: 0.07,   // 業界平均 7%
    good: 0.10,      // 10%以上で優良
    label: 'CTR',
    format: 'percent',
    alertLow: true,   // 低い値が悪い
  },
  CPC: {
    danger: 600,     // ¥600超で危険
    warning: 400,    // ¥400超で注意
    average: 400,    // 業界平均 ¥400
    good: 200,       // ¥200以下で優良
    label: 'CPC',
    format: 'yen',
    alertLow: false,  // 高い値が悪い
  },
  CVR: {
    danger: 0.02,    // 2%未満で危険
    warning: 0.04,   // 4%未満で注意
    average: 0.05,   // 業界平均 5%
    good: 0.08,      // 8%以上で優良
    label: 'CVR',
    format: 'percent',
    alertLow: true,
  },
  CPA: {
    danger: 15000,   // ¥15,000超で危険
    warning: 10000,  // ¥10,000超で注意
    average: 7500,   // 業界平均
    good: 5000,      // ¥5,000以下で優良
    label: 'CPA',
    format: 'yen',
    alertLow: false,
  },
  BUDGET_RATE: {
    dangerLow: 0.50,  // 50%未満で警告
    dangerHigh: 1.20,  // 120%超で警告
    average: 0.90,
    label: '予算消化率',
    format: 'percent',
  },
  BOUNCE_RATE: {
    danger: 0.70,
    warning: 0.65,
    average: 0.575,
    good: 0.40,
    label: '直帰率',
    format: 'percent',
    alertLow: false,
  },
  AVG_SESSION_DURATION: {
    danger: 30,       // 30秒未満で危険
    warning: 60,      // 1分未満で注意
    average: 105,     // 1分45秒
    good: 180,        // 3分以上で優良
    label: '平均滞在時間',
    format: 'seconds',
    alertLow: true,
  },
};
