#!/usr/bin/env python3
"""
ニコニコカーローン ダッシュボード 自動更新スクリプト

使い方:
  python3 update_dashboard.py /path/to/csv/folder
  python3 update_dashboard.py --from-json data/2026-03-01.json

CSVモード:
  Google広告管理画面から「概要カード」のCSVをエクスポートしたフォルダを指定してください。
  スクリプトが自動的にCSVを解析し、dashboard.html に新しい日付タブを追加します。

JSONモード (--from-json):
  GAS/GitHub Actions 経由で生成された data/*.json ファイルを直接読み込み、
  CSV解析をスキップしてダッシュボードHTMLを生成します。
"""

import sys
import os
import csv
import re
import json
import unicodedata
from datetime import datetime, timedelta

# Paths
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_PATH = os.path.join(SCRIPT_DIR, 'dashboard.html')
DATA_DIR = os.path.join(SCRIPT_DIR, 'data')


# ============================================================
# CSV Parsing
# ============================================================

def parse_yen(s):
    """Parse yen string like '￥12,889' or '¥12,889' to int"""
    if not s or s.strip() in ('', '—', '-'):
        return 0
    return int(re.sub(r'[￥¥,\s]', '', s.strip()))


def parse_pct(s):
    """Parse percentage string like '18.74%' to float"""
    if not s or s.strip() in ('', '—', '-'):
        return 0.0
    return float(s.replace('%', '').strip())


def parse_int(s):
    """Parse integer string with possible commas"""
    if not s or s.strip() in ('', '—', '-'):
        return 0
    return int(s.replace(',', '').strip())


def parse_float(s):
    """Parse float string"""
    if not s or s.strip() in ('', '—', '-'):
        return 0.0
    return float(s.replace(',', '').strip())


def detect_date(csv_dir):
    """Detect date from CSV filenames"""
    for f in os.listdir(csv_dir):
        f_nfc = unicodedata.normalize('NFC', f)
        m = re.search(r'(\d{4})\.(\d{2})\.(\d{2})', f_nfc)
        if m:
            return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)))
    return None


def find_csv(csv_dir, pattern):
    """Find a CSV file matching pattern in directory (handles macOS NFD filenames)"""
    for f in os.listdir(csv_dir):
        # Normalize to NFC for consistent matching (macOS uses NFD)
        f_nfc = unicodedata.normalize('NFC', f)
        if re.search(pattern, f_nfc):
            return os.path.join(csv_dir, f)  # Use original filename for path
    return None


def read_csv(filepath):
    """Read CSV file and return rows"""
    if not filepath or not os.path.exists(filepath):
        return None
    with open(filepath, encoding='utf-8') as fp:
        return list(csv.reader(fp))


def parse_campaign(csv_dir):
    """Parse campaign CSV → {name, cost, clicks, ctr}"""
    rows = read_csv(find_csv(csv_dir, r'キャンペーン\('))
    if not rows or len(rows) < 2:
        return None
    d = rows[1]
    return {
        'name': d[0],
        'cost': parse_yen(d[3]),
        'clicks': parse_int(d[4]),
        'ctr': parse_pct(d[5]),
    }


def parse_adgroups(csv_dir):
    """Parse ad group report CSV → {groups: [...], total: {...}}"""
    rows = read_csv(find_csv(csv_dir, r'広告グループ レポート'))
    if not rows:
        # Fallback: try 広告レポート.csv
        return parse_ad_report(csv_dir)

    # Find header row
    header_idx = None
    for i, row in enumerate(rows):
        if row and any('広告グループのステータス' in cell for cell in row):
            header_idx = i
            break
    if header_idx is None:
        return None

    # Build column index map from header
    header = rows[header_idx]
    col = {}
    for i, cell in enumerate(header):
        cell_clean = cell.strip()
        if '表示回数' in cell_clean:
            col['impressions'] = i
        elif 'クリック率' in cell_clean:
            col['ctr'] = i
        elif '費用' in cell_clean:
            col['cost'] = i
        elif 'クリック数' in cell_clean:
            col['clicks'] = i
        elif 'コンバージョン率' in cell_clean:
            col['cvr'] = i
        elif 'コンバージョン単価' in cell_clean:
            col['cpa'] = i
        elif 'コンバージョン' in cell_clean:
            col['cv'] = i
        elif '平均クリック単価' in cell_clean:
            col['cpc'] = i
        elif '広告グループ' == cell_clean:
            col['name'] = i

    groups = []
    total = None
    for row in rows[header_idx + 1:]:
        if not row or len(row) < len(header) - 1:
            continue
        if row[0].startswith('合計'):
            total = {
                'impressions': parse_int(row[col['impressions']]),
                'ctr': parse_pct(row[col['ctr']]),
                'cost': parse_int(row[col['cost']]),
                'clicks': parse_int(row[col['clicks']]),
                'cvr': parse_pct(row[col['cvr']]),
                'cv': parse_float(row[col['cv']]),
                'cpc': parse_int(row[col['cpc']]),
                'cpa': parse_int(row[col.get('cpa', len(row))]) if 'cpa' in col and col['cpa'] < len(row) else 0,
            }
            break
        groups.append({
            'name': row[col.get('name', 1)],
            'impressions': parse_int(row[col['impressions']]),
            'ctr': parse_pct(row[col['ctr']]),
            'cost': parse_int(row[col['cost']]),
            'clicks': parse_int(row[col['clicks']]),
            'cvr': parse_pct(row[col['cvr']]),
            'cv': parse_float(row[col['cv']]),
            'cpc': parse_int(row[col['cpc']]),
            'cpa': parse_int(row[col.get('cpa', len(row))]) if 'cpa' in col and col['cpa'] < len(row) else 0,
        })
    return {'groups': groups, 'total': total}


def parse_keywords(csv_dir):
    """Parse search keywords CSV"""
    rows = read_csv(find_csv(csv_dir, r'検索キーワード\('))
    if not rows or len(rows) < 2:
        return None
    keywords = []
    for row in rows[1:]:
        if not row or len(row) < 8 or not row[0].strip():
            continue
        keywords.append({
            'keyword': row[0],
            'match_type': row[1].replace('インテント マッチ', 'インテント').replace('フレーズ一致', 'フレーズ'),
            'cost': parse_yen(row[5]),
            'clicks': parse_int(row[6]),
            'ctr': parse_pct(row[7]),
        })
    # Sort by clicks desc, then cost desc
    keywords.sort(key=lambda x: (-x['clicks'], -x['cost']))
    return keywords


def parse_search_terms(csv_dir):
    """Parse search network terms CSV"""
    rows = read_csv(find_csv(csv_dir, r'検索\(検索ネットワーク'))
    if not rows or len(rows) < 2:
        return None
    terms = []
    for row in rows[1:]:
        if not row or len(row) < 4 or not row[0].strip():
            continue
        terms.append({
            'term': row[0],
            'cost': parse_yen(row[1]),
            'clicks': parse_int(row[2]),
            'impressions': parse_int(row[3]),
        })
    # Sort by impressions desc
    terms.sort(key=lambda x: (-x['impressions'], -x['cost']))
    return terms[:15]  # Top 15


def parse_hourly(csv_dir):
    """Parse hourly data CSV"""
    rows = read_csv(find_csv(csv_dir, r'期間\('))
    if not rows or len(rows) < 2:
        return None
    hours = []
    for row in rows[1:]:
        if not row or len(row) < 5 or not row[0].strip():
            continue
        hours.append({
            'hour': row[0],
            'clicks': parse_int(row[1]),
            'impressions': parse_int(row[2]),
            'cpc': parse_yen(row[3]),
            'cost': parse_yen(row[4]),
        })
    return hours


def parse_devices(csv_dir):
    """Parse device data CSV"""
    rows = read_csv(find_csv(csv_dir, r'デバイス\('))
    if not rows or len(rows) < 2:
        return None
    devices = []
    for row in rows[1:]:
        if not row or len(row) < 4 or not row[0].strip():
            continue
        devices.append({
            'device': row[0],
            'cost': parse_yen(row[1]),
            'impressions': parse_int(row[2]),
            'clicks': parse_int(row[3]),
        })
    # Sort by clicks desc
    devices.sort(key=lambda x: -x['clicks'])
    return devices


def parse_network(csv_dir):
    """Parse network data CSV"""
    rows = read_csv(find_csv(csv_dir, r'ネットワーク\('))
    if not rows or len(rows) < 2:
        return None
    networks = []
    for row in rows[1:]:
        if not row or len(row) < 4 or not row[0].strip():
            continue
        networks.append({
            'network': row[0],
            'clicks': parse_int(row[1]),
            'cost': parse_yen(row[2]),
            'cpc': parse_yen(row[3]),
        })
    networks.sort(key=lambda x: -x['clicks'])
    return networks


def parse_gender(csv_dir):
    """Parse gender demographics CSV"""
    rows = read_csv(find_csv(csv_dir, r'ユーザー属性\(性別_\d'))
    if not rows or len(rows) < 2:
        return None
    genders = []
    for row in rows[1:]:
        if not row or len(row) < 3 or not row[0].strip():
            continue
        genders.append({
            'gender': row[0],
            'impressions': parse_int(row[1]),
            'pct': parse_pct(row[2]),
        })
    genders.sort(key=lambda x: -x['impressions'])
    return genders


def parse_age(csv_dir):
    """Parse age demographics CSV"""
    rows = read_csv(find_csv(csv_dir, r'ユーザー属性\(年齢'))
    if not rows or len(rows) < 2:
        return None
    ages = []
    for row in rows[1:]:
        if not row or len(row) < 3 or not row[0].strip():
            continue
        ages.append({
            'age_range': row[0],
            'impressions': parse_int(row[1]),
            'pct': parse_pct(row[2]),
        })
    ages.sort(key=lambda x: -x['impressions'])
    return ages


def parse_optimization_score(csv_dir):
    """Parse optimization score CSV"""
    rows = read_csv(find_csv(csv_dir, r'最適化スコア\('))
    if not rows or len(rows) < 2:
        return None
    return parse_pct(rows[1][0])


def parse_ad_report(csv_dir):
    """Parse 広告レポート CSV as fallback for ad group data.
    This CSV has ad-level rows with ad group info, plus total rows."""
    rows = read_csv(find_csv(csv_dir, r'^広告レポート\.csv$'))
    if not rows:
        return None

    # Find header row (row with 広告グループ column)
    header_idx = None
    for i, row in enumerate(rows):
        if row and any('広告グループ' in cell for cell in row):
            header_idx = i
            break
    if header_idx is None:
        return None

    header = rows[header_idx]
    col = {}
    for i, cell in enumerate(header):
        c = cell.strip()
        if c == '広告グループ':
            col['name'] = i
        elif c == '表示回数':
            col['impressions'] = i
        elif c == 'クリック率':
            col['ctr'] = i
        elif c == '費用':
            col['cost'] = i
        elif c == 'クリック数':
            col['clicks'] = i
        elif c == 'コンバージョン率':
            col['cvr'] = i
        elif c == 'コンバージョン単価':
            col['cpa'] = i
        elif c == 'コンバージョン':
            col['cv'] = i
        elif c == '平均クリック単価':
            col['cpc'] = i

    # Aggregate by ad group
    group_data = {}
    total = None
    for row in rows[header_idx + 1:]:
        if not row or len(row) <= max(col.values()):
            continue
        if row[0].startswith('合計'):
            # First total row has the data we need
            if total is None:
                total = {
                    'impressions': parse_int(row[col['impressions']]),
                    'ctr': parse_pct(row[col['ctr']]),
                    'cost': parse_int(row[col['cost']]),
                    'clicks': parse_int(row[col['clicks']]),
                    'cvr': parse_pct(row[col['cvr']]),
                    'cv': parse_float(row[col['cv']]),
                    'cpc': parse_int(row[col['cpc']]),
                    'cpa': parse_int(row[col.get('cpa', 0)]) if 'cpa' in col else 0,
                }
            continue
        name = row[col.get('name', 0)]
        if not name or name.startswith('合計'):
            continue
        # Clean up ad group name (remove "GR1: " prefix inconsistency)
        name_clean = name.strip()
        if name_clean not in group_data:
            group_data[name_clean] = {
                'name': name_clean, 'impressions': 0, 'cost': 0,
                'clicks': 0, 'cv': 0.0,
            }
        g = group_data[name_clean]
        g['impressions'] += parse_int(row[col['impressions']])
        g['cost'] += parse_int(row[col['cost']])
        g['clicks'] += parse_int(row[col['clicks']])
        g['cv'] += parse_float(row[col['cv']])

    # Calculate derived metrics per group
    groups = []
    for g in group_data.values():
        g['ctr'] = (g['clicks'] / g['impressions'] * 100) if g['impressions'] > 0 else 0
        g['cpc'] = (g['cost'] // g['clicks']) if g['clicks'] > 0 else 0
        g['cvr'] = (g['cv'] / g['clicks'] * 100) if g['clicks'] > 0 else 0
        g['cpa'] = int(g['cost'] // g['cv']) if g['cv'] > 0 else 0
        groups.append(g)

    return {'groups': groups, 'total': total}


def parse_clarity_dashboard(csv_dir):
    """Parse Clarity dashboard CSV"""
    filepath = find_csv(csv_dir, r'Clarity_.*ダッシュボード')
    if not filepath:
        return None
    with open(filepath, encoding='utf-8-sig') as fp:
        lines = fp.read()

    data = {}
    # Sessions
    m = re.search(r'セッションの合計数","(\d+)', lines)
    if m:
        data['sessions'] = int(m.group(1))
    m = re.search(r'ボット セッション","(\d+)', lines)
    if m:
        data['bot_sessions'] = int(m.group(1))
    # Scroll depth
    m = re.search(r'スクロールの奥行き.*?"平均","(\d+)', lines, re.DOTALL)
    if m:
        data['scroll_depth'] = int(m.group(1))
    # Active time
    m = re.search(r'アクティブ時間","(\d+)', lines)
    if m:
        data['active_time'] = int(m.group(1))
    m = re.search(r'所要時間","(\d+)', lines)
    if m:
        data['total_time'] = int(m.group(1))
    # Users
    m = re.search(r'ユニーク ユーザー","(\d+)', lines)
    if m:
        data['unique_users'] = int(m.group(1))
    m = re.search(r'新規ユーザーとのセッション","(\d+)', lines)
    if m:
        data['new_sessions'] = int(m.group(1))
    m = re.search(r'リピーターとのセッション","(\d+)', lines)
    if m:
        data['returning_sessions'] = int(m.group(1))
    # Insights
    m = re.search(r'デッド クリック","(\d+)","([\d.]+)%', lines)
    if m:
        data['dead_clicks'] = {'count': int(m.group(1)), 'pct': float(m.group(2))}
    m = re.search(r'クイック バック クリック","(\d+)","([\d.]+)%', lines)
    if m:
        data['quick_back'] = {'count': int(m.group(1)), 'pct': float(m.group(2))}
    m = re.search(r'イライラしたクリック","(\d+)","([\d.]+)%', lines)
    if m:
        data['rage_clicks'] = {'count': int(m.group(1)), 'pct': float(m.group(2))}
    # Browsers
    browsers = []
    for bm in re.finditer(r'"","(Chrome\w*|MobileSafari|GoogleApp|InstagramApp|Unknown|Safari|Firefox\w*|Edge\w*|SamsungBrowser\w*)","(\d+)","([\d.]+)%"', lines):
        browsers.append({'name': bm.group(1), 'sessions': int(bm.group(2)), 'pct': float(bm.group(3))})
    if browsers:
        data['browsers'] = browsers
    # Top pages
    pages = []
    for pm in re.finditer(r'"","(https://relief-trust\.com[^"]*)","(\d+)"', lines):
        pages.append({'url': pm.group(1), 'sessions': int(pm.group(2))})
    if pages:
        data['top_pages'] = pages
    # Referrers
    referrers = []
    ref_section = re.search(r'"メトリック","参照元"(.*?)(?:"メトリック"|$)', lines, re.DOTALL)
    if ref_section:
        for rm in re.finditer(r'"","([^"]+)","(\d+)"', ref_section.group(1)):
            referrers.append({'source': rm.group(1), 'sessions': int(rm.group(2))})
    if referrers:
        data['referrers'] = referrers
    # Performance
    m_score = re.search(r'スコア","([\d.]+)', lines)
    m_lcp = re.search(r'LCP[^"]*","([\d.]+s)', lines)
    m_inp = re.search(r'INP[^"]*","(\d+ms)', lines)
    m_cls = re.search(r'CLS[^"]*","([\d.]+s)', lines)
    if m_score:
        data['performance'] = {
            'score': float(m_score.group(1)),
            'lcp': m_lcp.group(1) if m_lcp else '—',
            'inp': m_inp.group(1) if m_inp else '—',
            'cls': m_cls.group(1) if m_cls else '—',
        }
    # Outbound clicks
    m = re.search(r'アウトバウンド クリック","(\d+)","([\d.]+)%', lines)
    if m:
        data['outbound_clicks'] = {'count': int(m.group(1)), 'pct': float(m.group(2))}

    return data if data else None


def parse_clarity_scroll(csv_dir):
    """Parse Clarity scroll depth CSV"""
    filepath = find_csv(csv_dir, r'Clarity_.*Scroll')
    if not filepath:
        return None
    with open(filepath, encoding='utf-8-sig') as fp:
        content = fp.read()

    m = re.search(r'ページ ビュー","(\d+)', content)
    page_views = int(m.group(1)) if m else 0

    rows = read_csv(filepath)
    if not rows:
        return None

    scroll_data = []
    for row in rows:
        if not row or len(row) < 3:
            continue
        try:
            depth = int(row[0])
            visitors = int(row[1])
            dropoff = float(row[2])
            scroll_data.append({'depth': depth, 'visitors': visitors, 'dropoff': dropoff})
        except (ValueError, IndexError):
            continue

    return {'page_views': page_views, 'data': scroll_data} if scroll_data else None


def parse_ga4_pages(csv_dir):
    """Parse GA4 pages CSV"""
    filepath = find_csv(csv_dir, r'ページとスクリーン')
    if not filepath:
        return None
    with open(filepath, encoding='utf-8') as fp:
        lines = fp.readlines()

    # Skip comment lines starting with #
    data_lines = [l for l in lines if not l.startswith('#') and l.strip()]
    if not data_lines:
        return None

    import io
    reader = csv.reader(io.StringIO(''.join(data_lines)))
    rows = list(reader)
    if len(rows) < 2:
        return None

    header = rows[0]
    pages = []
    for row in rows[1:]:
        if not row or not row[0].strip():
            continue
        pages.append({
            'path': row[0],
            'source': row[1] if len(row) > 1 else '',
            'views': parse_int(row[2]) if len(row) > 2 else 0,
            'active_users': parse_int(row[3]) if len(row) > 3 else 0,
            'avg_engagement': parse_float(row[5]) if len(row) > 5 else 0,
            'events': parse_int(row[6]) if len(row) > 6 else 0,
        })

    # Aggregate by path
    path_totals = {}
    for p in pages:
        path = p['path']
        if path not in path_totals:
            path_totals[path] = {'path': path, 'views': 0, 'active_users': 0, 'total_engagement': 0, 'events': 0, 'sources': []}
        pt = path_totals[path]
        pt['views'] += p['views']
        pt['active_users'] += p['active_users']
        pt['total_engagement'] += p['avg_engagement'] * p['active_users']
        pt['events'] += p['events']
        if p['source'] and p['views'] > 0:
            pt['sources'].append({'source': p['source'], 'views': p['views'], 'users': p['active_users']})

    result = []
    for pt in path_totals.values():
        pt['avg_engagement'] = pt['total_engagement'] / pt['active_users'] if pt['active_users'] > 0 else 0
        del pt['total_engagement']
        pt['sources'].sort(key=lambda x: -x['views'])
        result.append(pt)

    result.sort(key=lambda x: -x['views'])
    return result


# ============================================================
# Data Storage
# ============================================================

def save_daily_data(date, data):
    """Save daily data as JSON"""
    os.makedirs(DATA_DIR, exist_ok=True)
    filepath = os.path.join(DATA_DIR, f'{date.strftime("%Y-%m-%d")}.json')
    with open(filepath, 'w', encoding='utf-8') as fp:
        json.dump(data, fp, ensure_ascii=False, indent=2)
    return filepath


def load_daily_data(date_str):
    """Load daily data from JSON"""
    filepath = os.path.join(DATA_DIR, f'{date_str}.json')
    if not os.path.exists(filepath):
        return None
    with open(filepath, encoding='utf-8') as fp:
        return json.load(fp)


def find_previous_day(date):
    """Find the most recent previous day's data"""
    for i in range(1, 30):
        prev = date - timedelta(days=i)
        data = load_daily_data(prev.strftime('%Y-%m-%d'))
        if data:
            return data
    return None


def load_all_daily_data():
    """Load all daily data files and return sorted list"""
    if not os.path.exists(DATA_DIR):
        return []
    data_files = []
    for f in os.listdir(DATA_DIR):
        if f.endswith('.json'):
            filepath = os.path.join(DATA_DIR, f)
            with open(filepath, encoding='utf-8') as fp:
                data_files.append(json.load(fp))
    data_files.sort(key=lambda x: x.get('date', ''))
    return data_files


# ============================================================
# Formatting Helpers
# ============================================================

def fmt_yen(n):
    """Format as yen: ¥12,889"""
    return f'&#165;{n:,}'


def fmt_num(n):
    """Format number with commas"""
    return f'{n:,}'


def fmt_pct(n):
    """Format as percentage"""
    return f'{n:.2f}%'


def pct_change(old, new):
    """Calculate percentage change"""
    if old == 0:
        return '+∞' if new > 0 else '±0'
    change = ((new - old) / old) * 100
    if change > 0:
        return f'+{change:.1f}%'
    else:
        return f'{change:.1f}%'


def pt_change(old, new):
    """Calculate point change"""
    diff = new - old
    if diff > 0:
        return f'+{diff:.2f}pt'
    else:
        return f'{diff:.2f}pt'


# ============================================================
# HTML Generation
# ============================================================

def gen_overview(data, prev, cumulative, date):
    """Generate overview section HTML"""
    c = data['campaign']
    m = date.month
    d = date.day
    prev_day_label = ''
    if prev:
        pc = prev['campaign']
        prev_day_label = f'{prev["date"][5:7]}/{prev["date"][8:10]}'

    # Determine colors
    ctr_color = 'var(--success)' if c['ctr'] > 5 else 'var(--warning)' if c['ctr'] > 3 else 'var(--danger)'
    cpc_color = 'var(--success)' if c['cpc'] < 200 else 'var(--warning)' if c['cpc'] < 400 else 'var(--danger)'

    # CPC sub text
    cpc_sub = f'CPC: {fmt_yen(c["cpc"])}'
    if prev:
        cpc_change = pct_change(pc['cpc'], c['cpc'])
        cpc_sub = f'前日: {fmt_yen(pc["cpc"])}（{cpc_change}）'

    # CTR sub text
    ctr_sub = ''
    if prev:
        ctr_sub = f'前日: {fmt_pct(pc["ctr"])}'

    html = f'''  <!-- ===== 1. キャンペーン概要 ===== -->
  <div id="section-overview-{data['tab_key']}" class="tab-content active">

    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-label">総費用</div>
        <div class="kpi-value">{fmt_yen(c['cost'])}</div>
        <div class="kpi-sub">キャンペーン: {c['name']}</div>
        <div class="kpi-accent" style="background:var(--primary)"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">クリック数</div>
        <div class="kpi-value">{fmt_num(c['clicks'])}</div>
        <div class="kpi-sub">表示回数: {fmt_num(c['impressions'])}</div>
        <div class="kpi-accent" style="background:var(--primary)"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">CTR（クリック率）</div>
        <div class="kpi-value" style="color:{ctr_color}">{fmt_pct(c['ctr'])}</div>
        <div class="kpi-sub">{ctr_sub}</div>
        <div class="kpi-accent" style="background:{ctr_color}"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">平均CPC</div>
        <div class="kpi-value" style="color:{cpc_color}">{fmt_yen(c['cpc'])}</div>
        <div class="kpi-sub">{cpc_sub}</div>
        <div class="kpi-accent" style="background:{cpc_color}"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Google広告CV（LINE問い合わせ）</div>
        <div class="kpi-value" style="color:{'var(--success)' if c['cv'] > 0 else 'var(--gray-600)'};">{c['cv']:.0f}</div>
        <div class="kpi-sub">CVR: {fmt_pct(c['cvr'])} ｜ CPA: {fmt_yen(c['cpa']) if c['cpa'] > 0 else '—'}</div>
        <div class="kpi-accent" style="background:{'var(--success)' if c['cv'] > 0 else 'var(--gray-300)'}"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">Clarityセッション</div>
        <div class="kpi-value" style="color:{'var(--primary)' if data.get('clarity') else 'var(--gray-600)'}">{data['clarity']['sessions'] if data.get('clarity') else '—'}</div>
        <div class="kpi-sub">{'ユニークユーザー: ' + str(data['clarity']['unique_users']) + ' ｜ 新規: ' + str(data['clarity'].get('new_sessions', '—')) if data.get('clarity') else 'データ未取得'}</div>
        <div class="kpi-accent" style="background:{'var(--primary)' if data.get('clarity') else 'var(--gray-300)'}"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">平均スクロール深度</div>
        <div class="kpi-value" style="color:{'var(--warning)' if data.get('clarity') and data['clarity'].get('scroll_depth', 0) < 50 else 'var(--success)' if data.get('clarity') else 'var(--gray-600)'}">{str(data['clarity']['scroll_depth']) + '%' if data.get('clarity') and data['clarity'].get('scroll_depth') else '—'}</div>
        <div class="kpi-sub">{'ページの' + str(data['clarity']['scroll_depth']) + '%まで閲覧' if data.get('clarity') and data['clarity'].get('scroll_depth') else 'データ未取得'}</div>
        <div class="kpi-accent" style="background:{'var(--warning)' if data.get('clarity') else 'var(--gray-300)'}"></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-label">平均アクティブ時間</div>
        <div class="kpi-value" style="color:{'var(--primary)' if data.get('clarity') else 'var(--gray-600)'}">{str(data['clarity']['active_time']) + '秒' if data.get('clarity') and data['clarity'].get('active_time') else '—'}</div>
        <div class="kpi-sub">{'総滞在: ' + str(data['clarity']['total_time']) + '秒' if data.get('clarity') and data['clarity'].get('total_time') else 'データ未取得'}</div>
        <div class="kpi-accent" style="background:{'var(--primary)' if data.get('clarity') else 'var(--gray-300)'}"></div>
      </div>
    </div>

    <div class="info-success" style="margin-top:16px;">
      <strong>{m}/{d} 終日データ確定済み。</strong>CPC {fmt_yen(c['cpc'])}、CTR {fmt_pct(c['ctr'])}、CV {c['cv']:.0f}件。
    </div>
'''

    # Comparison table
    if prev:
        pc = prev['campaign']
        html += f'''
    <!-- 前日比較 -->
    <div class="section">
      <div class="section-header">
        <h3>前日（{prev_day_label}）との比較</h3>
        <span class="badge badge-success">確定データ</span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>指標</th><th class="num">{prev_day_label}</th><th class="num">{m}/{d}</th><th class="num">変化</th></tr>
        </thead>
        <tbody>
          <tr><td>広告費用</td><td class="num">{fmt_yen(pc['cost'])}</td><td class="num">{fmt_yen(c['cost'])}</td><td class="num">{pct_change(pc['cost'], c['cost'])}</td></tr>
          <tr><td>広告クリック数</td><td class="num">{fmt_num(pc['clicks'])}</td><td class="num" style="font-weight:700">{fmt_num(c['clicks'])}</td><td class="num">{pct_change(pc['clicks'], c['clicks'])}</td></tr>
          <tr><td>広告表示回数</td><td class="num">{fmt_num(pc['impressions'])}</td><td class="num">{fmt_num(c['impressions'])}</td><td class="num">{pct_change(pc['impressions'], c['impressions'])}</td></tr>
          <tr><td>CTR</td><td class="num">{fmt_pct(pc['ctr'])}</td><td class="num" style="font-weight:700">{fmt_pct(c['ctr'])}</td><td class="num">{pt_change(pc['ctr'], c['ctr'])}</td></tr>
          <tr><td>平均CPC</td><td class="num">{fmt_yen(pc['cpc'])}</td><td class="num" style="font-weight:700">{fmt_yen(c['cpc'])}</td><td class="num">{pct_change(pc['cpc'], c['cpc'])}</td></tr>
          <tr style="background:var(--success-light)"><td><strong>Google広告CV</strong></td><td class="num">{pc['cv']:.0f}</td><td class="num" style="font-weight:700">{c['cv']:.0f}</td><td class="num">{c['cv'] - pc['cv']:+.0f}件</td></tr>
          <tr><td>CVR</td><td class="num">{fmt_pct(pc['cvr'])}</td><td class="num">{fmt_pct(c['cvr'])}</td><td class="num">{pt_change(pc['cvr'], c['cvr'])}</td></tr>
          <tr><td>CPA</td><td class="num">{fmt_yen(pc['cpa']) if pc['cpa'] > 0 else '—'}</td><td class="num">{fmt_yen(c['cpa']) if c['cpa'] > 0 else '—'}</td><td class="num">{pct_change(pc['cpa'], c['cpa']) if pc['cpa'] > 0 and c['cpa'] > 0 else '—'}</td></tr>
        </tbody>
      </table>
    </div>
'''

    # Cumulative summary
    if cumulative:
        html += f'''
    <!-- 累計サマリー -->
    <div class="section">
      <div class="section-header">
        <h3>{cumulative['days']}日間累計サマリー（{cumulative['period']}）</h3>
        <span class="badge badge-success">確定データ</span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>指標</th><th class="num">{cumulative['days']}日間累計</th></tr>
        </thead>
        <tbody>
          <tr><td>広告費用</td><td class="num" style="font-weight:700">{fmt_yen(cumulative['cost'])}</td></tr>
          <tr><td>クリック数</td><td class="num" style="font-weight:700">{fmt_num(cumulative['clicks'])}</td></tr>
          <tr><td>表示回数</td><td class="num">{fmt_num(cumulative['impressions'])}</td></tr>
          <tr><td>CTR（クリック率）</td><td class="num" style="font-weight:700">{fmt_pct(cumulative['ctr'])}</td></tr>
          <tr><td>平均CPC</td><td class="num" style="font-weight:700">{fmt_yen(cumulative['cpc'])}</td></tr>
          <tr style="background:var(--success-light)"><td><strong>Google広告CV（LINE問い合わせ）</strong></td><td class="num" style="font-weight:700;color:var(--success)">{cumulative['cv']:.0f}件</td></tr>
          <tr><td>CVR（コンバージョン率）</td><td class="num">{fmt_pct(cumulative['cvr'])}</td></tr>
          <tr><td>CPA（獲得単価）</td><td class="num">{fmt_yen(cumulative['cpa'])}</td></tr>
          <tr><td>最適化スコア</td><td class="num">{fmt_pct(c.get('optimization_score', 0))}</td></tr>
        </tbody>
      </table>
    </div>
'''

    html += '  </div>\n'
    return html


def gen_funnel(data):
    """Generate funnel section HTML"""
    c = data['campaign']
    return f'''
  <!-- ===== 2. 実績ファネル ===== -->
  <div id="section-funnel-{data['tab_key']}" class="tab-content">
    <div class="section">
      <div class="section-header">
        <h3>実績ファネル（{data['date'][5:7]}/{data['date'][8:10]} 終日）</h3>
        <span class="badge badge-success">確定データ</span>
      </div>
      <div class="kpi-grid" style="margin-bottom:24px;">
        <div class="kpi-card" style="border-left:4px solid var(--primary);">
          <div class="kpi-label">広告クリック</div>
          <div class="kpi-value" style="color:var(--primary);">{fmt_num(c['clicks'])}<span style="font-size:14px;color:var(--gray-600)"> クリック</span></div>
          <div class="kpi-sub">表示: {fmt_num(c['impressions'])} ｜ CTR: {fmt_pct(c['ctr'])} ｜ 費用: {fmt_yen(c['cost'])}</div>
        </div>
        <div class="kpi-card" style="border-left:4px solid #6b7280;">
          <div class="kpi-label">Clarityセッション</div>
          <div class="kpi-value" style="color:{'var(--primary)' if data.get('clarity') else 'var(--gray-600)'};">{data['clarity']['sessions'] if data.get('clarity') else '—'}</div>
          <div class="kpi-sub">{'ユニーク: ' + str(data['clarity']['unique_users']) if data.get('clarity') else 'データ未取得'}</div>
        </div>
        <div class="kpi-card" style="border-left:4px solid #00b900;">
          <div class="kpi-label">フォームページ到達（GA4）</div>
          <div class="kpi-value" style="color:{'var(--primary)' if data.get('ga4_pages') else 'var(--gray-600)'};">{sum(p['views'] for p in data['ga4_pages'] if '/form' in p['path']) if data.get('ga4_pages') else '—'}</div>
          <div class="kpi-sub">{'GA4フォームPV' if data.get('ga4_pages') else 'データ未取得'}</div>
        </div>
        <div class="kpi-card" style="border-left:4px solid var(--success);">
          <div class="kpi-label">Google広告CV（LINE問い合わせ）</div>
          <div class="kpi-value" style="color:var(--success);">{c['cv']:.0f}<span style="font-size:14px;color:var(--gray-600)"> 件</span></div>
          <div class="kpi-sub">CVR: {fmt_pct(c['cvr'])} ｜ CPA: {fmt_yen(c['cpa']) if c['cpa'] > 0 else '—'}</div>
        </div>
      </div>
      <div class="funnel">
        <div class="funnel-step" style="width:100%;background:#0d47a1;">
          <span class="f-label">広告表示回数</span>
          <span class="f-value">{fmt_num(c['impressions'])}</span>
        </div>
        <div class="funnel-rate">CTR {fmt_pct(c['ctr'])}（CPC {fmt_yen(c['cpc'])}）</div>
        <div class="funnel-step" style="width:90%;background:#1565c0;">
          <span class="f-label">広告クリック（サイト訪問）</span>
          <span class="f-value">{fmt_num(c['clicks'])}</span>
        </div>
        <div class="funnel-rate">Google広告CV</div>
        <div class="funnel-step" style="width:30%;background:var(--success);">
          <span class="f-label">Google広告コンバージョン（LINE問い合わせ）</span>
          <span class="f-value" style="color:#ffeb3b;">{c['cv']:.0f}</span>
        </div>
      </div>
      <div class="info-primary" style="margin-top:16px;">
        <strong>ファネル分析:</strong> Clarity・GA4の詳細データが未取得のため、簡易ファネルで表示。
      </div>
    </div>
  </div>
'''


def gen_heatmap(data):
    """Generate heatmap section with Clarity data if available"""
    date_label = f'{data["date"][5:7]}/{data["date"][8:10]}'
    clarity = data.get('clarity')
    scroll = data.get('clarity_scroll')

    if not clarity and not scroll:
        return f'''
  <!-- ===== 3. ヒートマップ ===== -->
  <div id="section-heatmap-{data['tab_key']}" class="tab-content">
    <div class="section">
      <div class="section-header"><h3>Microsoft Clarity ダッシュボード（{date_label}）</h3></div>
      <div class="info-warning">
        {date_label}のClarityデータ（スクロール深度・アテンション・タップヒートマップ）は未取得です。<br>
        Microsoft Clarityのダッシュボードから{date_label}のデータをエクスポートしてください。
      </div>
    </div>
  </div>
'''

    html = f'''
  <!-- ===== 3. ヒートマップ ===== -->
  <div id="section-heatmap-{data['tab_key']}" class="tab-content">
'''

    # Clarity Dashboard Summary
    if clarity:
        html += f'''    <div class="section">
      <div class="section-header">
        <h3>Microsoft Clarity ダッシュボード（{date_label}）</h3>
        <span class="badge badge-success">Clarityデータ</span>
      </div>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">セッション数</div><div class="kpi-value">{clarity.get('sessions', '—')}</div><div class="kpi-sub">ボット除外: {clarity.get('sessions', 0) - clarity.get('bot_sessions', 0)} ｜ ボット: {clarity.get('bot_sessions', 0)}</div></div>
        <div class="kpi-card"><div class="kpi-label">ユニークユーザー</div><div class="kpi-value">{clarity.get('unique_users', '—')}</div><div class="kpi-sub">新規: {clarity.get('new_sessions', '—')} ｜ リピーター: {clarity.get('returning_sessions', '—')}</div></div>
        <div class="kpi-card"><div class="kpi-label">平均スクロール深度</div><div class="kpi-value" style="color:var(--warning)">{clarity.get('scroll_depth', '—')}%</div><div class="kpi-sub">ページの{clarity.get('scroll_depth', '—')}%まで閲覧</div></div>
        <div class="kpi-card"><div class="kpi-label">平均アクティブ時間</div><div class="kpi-value">{clarity.get('active_time', '—')}秒</div><div class="kpi-sub">総滞在時間: {clarity.get('total_time', '—')}秒</div></div>
      </div>
'''
        # Insights (Dead clicks, Quick back, etc.)
        dc = clarity.get('dead_clicks', {})
        qb = clarity.get('quick_back', {})
        rc = clarity.get('rage_clicks', {})
        ob = clarity.get('outbound_clicks', {})
        html += f'''
      <h4 style="font-size:14px;margin:20px 0 12px;">ユーザー行動インサイト</h4>
      <table class="data-table">
        <thead><tr><th>指標</th><th class="num">セッション数</th><th class="num">割合</th></tr></thead>
        <tbody>
          <tr><td>デッドクリック（反応しない要素タップ）</td><td class="num">{dc.get('count', 0)}</td><td class="num" style="color:{'var(--danger)' if dc.get('pct', 0) > 3 else 'var(--success)'}">{dc.get('pct', 0):.2f}%</td></tr>
          <tr><td>クイックバック（即座にブラウザバック）</td><td class="num">{qb.get('count', 0)}</td><td class="num" style="color:{'var(--danger)' if qb.get('pct', 0) > 5 else 'var(--success)'}">{qb.get('pct', 0):.2f}%</td></tr>
          <tr><td>レイジクリック（イライラした連打）</td><td class="num">{rc.get('count', 0)}</td><td class="num">{rc.get('pct', 0):.2f}%</td></tr>
          <tr><td>アウトバウンドクリック（外部リンク）</td><td class="num">{ob.get('count', 0)}</td><td class="num">{ob.get('pct', 0):.2f}%</td></tr>
        </tbody>
      </table>
'''
        # Top pages
        if clarity.get('top_pages'):
            html += '''
      <h4 style="font-size:14px;margin:20px 0 12px;">ページ別セッション</h4>
      <table class="data-table">
        <thead><tr><th>ページ</th><th class="num">セッション数</th></tr></thead>
        <tbody>
'''
            for p in clarity['top_pages']:
                page_name = 'TOPページ' if p['url'].rstrip('/').endswith('.com') else p['url'].replace('https://relief-trust.com', '')
                html += f'          <tr><td>{page_name}</td><td class="num" style="font-weight:700">{p["sessions"]}</td></tr>\n'
            html += '        </tbody>\n      </table>\n'

        # Browsers
        if clarity.get('browsers'):
            html += '''
      <h4 style="font-size:14px;margin:20px 0 12px;">ブラウザ別セッション</h4>
      <table class="data-table">
        <thead><tr><th>ブラウザ</th><th class="num">セッション数</th><th class="num">割合</th></tr></thead>
        <tbody>
'''
            for b in clarity['browsers']:
                html += f'          <tr><td>{b["name"]}</td><td class="num">{b["sessions"]}</td><td class="num">{b["pct"]:.2f}%</td></tr>\n'
            html += '        </tbody>\n      </table>\n'

        # Performance
        perf = clarity.get('performance', {})
        if perf:
            html += f'''
      <h4 style="font-size:14px;margin:20px 0 12px;">パフォーマンス</h4>
      <div class="kpi-grid">
        <div class="kpi-card"><div class="kpi-label">スコア</div><div class="kpi-value">{perf.get('score', 0):.1f}</div></div>
        <div class="kpi-card"><div class="kpi-label">LCP</div><div class="kpi-value">{perf.get('lcp', '—')}</div></div>
        <div class="kpi-card"><div class="kpi-label">INP</div><div class="kpi-value">{perf.get('inp', '—')}</div></div>
        <div class="kpi-card"><div class="kpi-label">CLS</div><div class="kpi-value">{perf.get('cls', '—')}</div></div>
      </div>
'''
        html += '    </div>\n'

    # Scroll depth data
    if scroll and scroll.get('data'):
        html += f'''    <div class="section">
      <div class="section-header">
        <h3>スクロール深度分析（{date_label}）</h3>
        <span class="badge badge-info">ページビュー: {scroll.get('page_views', '—')}</span>
      </div>
      <table class="data-table">
        <thead><tr><th>スクロール深度</th><th class="num">残存ユーザー数</th><th class="num">離脱率</th></tr></thead>
        <tbody>
'''
        for s in scroll['data']:
            dropoff_color = 'var(--danger)' if s['dropoff'] > 50 else 'var(--warning)' if s['dropoff'] > 30 else 'var(--success)'
            bg = ' style="background:var(--danger-light)"' if s['depth'] in (15, 20) and s['dropoff'] > 40 else ''
            html += f'          <tr{bg}><td><strong>{s["depth"]}%</strong></td><td class="num" style="font-weight:700">{s["visitors"]}</td><td class="num" style="color:{dropoff_color}">{s["dropoff"]:.1f}%</td></tr>\n'
        html += '        </tbody>\n      </table>\n    </div>\n'

    html += '  </div>\n'
    return html


def gen_ads(data, prev):
    """Generate Google Ads detail section"""
    c = data['campaign']
    html = f'''
  <!-- ===== 4. Google広告 詳細 ===== -->
  <div id="section-ads-{data['tab_key']}" class="tab-content">
    <div class="section">
      <div class="section-header">
        <h3>キャンペーン概要</h3>
        <span class="badge badge-success">{data['date'][:4]}/{data['date'][5:7]}/{data['date'][8:10]}（確定）</span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>キャンペーン名</th><th>ステータス</th><th class="num">費用</th><th class="num">クリック数</th><th class="num">表示回数</th><th class="num">CTR</th><th class="num">CPC</th><th class="num">CV</th><th class="num">CVR</th><th class="num">CPA</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>{c['name']}</strong></td>
            <td><span class="badge badge-success">有効（学習中）</span></td>
            <td class="num">{fmt_yen(c['cost'])}</td>
            <td class="num" style="font-weight:700">{fmt_num(c['clicks'])}</td>
            <td class="num">{fmt_num(c['impressions'])}</td>
            <td class="num" style="font-weight:700">{fmt_pct(c['ctr'])}</td>
            <td class="num" style="font-weight:700">{fmt_yen(c['cpc'])}</td>
            <td class="num" style="font-weight:700">{c['cv']:.2f}</td>
            <td class="num">{fmt_pct(c['cvr'])}</td>
            <td class="num">{fmt_yen(c['cpa']) if c['cpa'] > 0 else '—'}</td>
          </tr>
        </tbody>
      </table>
    </div>
'''

    # Ad groups
    if data.get('adgroups'):
        prev_day_label = ''
        if prev:
            prev_day_label = f'{prev["date"][5:7]}/{prev["date"][8:10]}'

        html += f'''
    <div class="section">
      <div class="section-header">
        <h3>広告グループ別パフォーマンス</h3>
        {f'<span class="badge badge-info">前日（{prev_day_label}）比較</span>' if prev else ''}
      </div>
      <table class="data-table">
        <thead>
          <tr><th>広告グループ</th><th class="num">費用</th><th class="num">クリック</th><th class="num">表示</th><th class="num">CTR</th><th class="num">CPC</th><th class="num">CV</th><th class="num">CVR</th></tr>
        </thead>
        <tbody>
'''
        for g in data['adgroups']['groups']:
            is_top = g['clicks'] == max(x['clicks'] for x in data['adgroups']['groups'])
            has_cv = g['cv'] > 0
            bg = ' style="background:var(--primary-light)"' if is_top else (' style="background:var(--success-light)"' if has_cv else '')
            html += f'''          <tr{bg}>
            <td><strong>{g['name']}</strong></td>
            <td class="num">{fmt_yen(g['cost'])}</td>
            <td class="num" style="font-weight:700">{fmt_num(g['clicks'])}</td>
            <td class="num">{fmt_num(g['impressions'])}</td>
            <td class="num">{fmt_pct(g['ctr'])}</td>
            <td class="num">{fmt_yen(g['cpc'])}</td>
            <td class="num">{g['cv']:.2f}</td>
            <td class="num">{fmt_pct(g['cvr'])}</td>
          </tr>
'''
        html += '''        </tbody>
      </table>
    </div>
'''

    # Network
    if data.get('network'):
        html += '''
    <div class="section">
      <div class="section-header"><h3>ネットワーク別パフォーマンス</h3></div>
      <table class="data-table">
        <thead>
          <tr><th>ネットワーク</th><th class="num">クリック数</th><th class="num">費用</th><th class="num">平均CPC</th></tr>
        </thead>
        <tbody>
'''
        for i, n in enumerate(data['network']):
            bg = ' style="background:var(--primary-light)"' if i == 0 else ''
            html += f'''          <tr{bg}>
            <td><strong>{n['network']}</strong></td>
            <td class="num" style="font-weight:700">{fmt_num(n['clicks'])}</td>
            <td class="num">{fmt_yen(n['cost'])}</td>
            <td class="num">{fmt_yen(n['cpc'])}</td>
          </tr>
'''
        html += '''        </tbody>
      </table>
    </div>
'''

    # Devices
    if data.get('devices'):
        html += '''
    <div class="section">
      <div class="section-header"><h3>デバイス別パフォーマンス</h3></div>
      <table class="data-table">
        <thead>
          <tr><th>デバイス</th><th class="num">表示回数</th><th class="num">クリック数</th><th class="num">費用</th></tr>
        </thead>
        <tbody>
'''
        for i, d in enumerate(data['devices']):
            bg = ' style="background:var(--primary-light)"' if i == 0 else ''
            html += f'''          <tr{bg}>
            <td><strong>{d['device']}</strong></td>
            <td class="num">{fmt_num(d['impressions'])}</td>
            <td class="num" style="font-weight:700">{fmt_num(d['clicks'])}</td>
            <td class="num">{fmt_yen(d['cost'])}</td>
          </tr>
'''
        html += '''        </tbody>
      </table>
    </div>
'''

    html += '  </div>\n'
    return html


def gen_keywords(data):
    """Generate keywords section"""
    html = f'''
  <!-- ===== 5. キーワード分析 ===== -->
  <div id="section-keywords-{data['tab_key']}" class="tab-content">
'''
    if data.get('keywords'):
        # Filter to keywords with clicks > 0
        active_kw = [k for k in data['keywords'] if k['clicks'] > 0]
        html += f'''    <div class="section">
      <div class="section-header">
        <h3>検索キーワード別パフォーマンス（{data['date'][5:7]}/{data['date'][8:10]}）</h3>
        <span class="badge badge-success">確定データ</span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>キーワード</th><th>マッチタイプ</th><th class="num">費用</th><th class="num">クリック</th><th class="num">CTR</th></tr>
        </thead>
        <tbody>
'''
        for i, k in enumerate(active_kw[:15]):
            bg = ' style="background:var(--primary-light)"' if i == 0 else ''
            html += f'''          <tr{bg}>
            <td><strong>{k['keyword']}</strong></td><td>{k['match_type']}</td>
            <td class="num">{fmt_yen(k['cost'])}</td><td class="num" style="font-weight:700">{k['clicks']}</td><td class="num">{fmt_pct(k['ctr'])}</td>
          </tr>
'''
        html += '''        </tbody>
      </table>
    </div>
'''
    else:
        html += f'''    <div class="section">
      <div class="section-header"><h3>キーワード分析（{data['date'][5:7]}/{data['date'][8:10]}）</h3></div>
      <div class="info-warning">キーワードデータが見つかりませんでした。</div>
    </div>
'''

    # Search terms
    if data.get('search_terms'):
        html += f'''    <div class="section">
      <div class="section-header"><h3>検索語句 TOP{min(len(data['search_terms']), 15)}</h3></div>
      <table class="data-table">
        <thead>
          <tr><th>検索語句</th><th class="num">費用</th><th class="num">クリック</th><th class="num">表示</th></tr>
        </thead>
        <tbody>
'''
        for t in data['search_terms'][:15]:
            html += f'''          <tr><td>{t['term']}</td><td class="num">{fmt_yen(t['cost'])}</td><td class="num">{t['clicks']}</td><td class="num">{t['impressions']}</td></tr>
'''
        html += '''        </tbody>
      </table>
    </div>
'''

    html += '  </div>\n'
    return html


def gen_users(data):
    """Generate user demographics section"""
    html = f'''
  <!-- ===== 6. ユーザー属性 ===== -->
  <div id="section-users-{data['tab_key']}" class="tab-content">
'''
    if data.get('gender') or data.get('age'):
        html += f'''    <div class="section">
      <div class="section-header">
        <h3>ユーザー属性分析（{data['date'][5:7]}/{data['date'][8:10]}）</h3>
        <span class="badge badge-success">確定データ</span>
      </div>
      <div class="grid-2">
'''
        if data.get('gender'):
            html += '''        <div>
          <h4 style="font-size:14px;margin-bottom:12px;">性別（表示回数ベース）</h4>
          <table class="data-table">
            <thead><tr><th>性別</th><th class="num">表示回数</th><th class="num">割合</th></tr></thead>
            <tbody>
'''
            for i, g in enumerate(data['gender']):
                bg = ' style="background:var(--primary-light)"' if i == 0 else ''
                html += f'''              <tr{bg}><td><strong>{g['gender']}</strong></td><td class="num">{fmt_num(g['impressions'])}</td><td class="num">{fmt_pct(g['pct'])}</td></tr>
'''
            html += '''            </tbody>
          </table>
        </div>
'''

        if data.get('age'):
            html += '''        <div>
          <h4 style="font-size:14px;margin-bottom:12px;">年齢（表示回数ベース）</h4>
          <table class="data-table">
            <thead><tr><th>年齢範囲</th><th class="num">表示回数</th><th class="num">割合</th></tr></thead>
            <tbody>
'''
            for i, a in enumerate(data['age']):
                bg = ' style="background:var(--primary-light)"' if i == 0 else ''
                html += f'''              <tr{bg}><td><strong>{a['age_range']}</strong></td><td class="num">{fmt_num(a['impressions'])}</td><td class="num">{fmt_pct(a['pct'])}</td></tr>
'''
            html += '''            </tbody>
          </table>
        </div>
'''

        html += '''      </div>
    </div>
'''
    else:
        html += f'''    <div class="section">
      <div class="section-header"><h3>ユーザー属性分析（{data['date'][5:7]}/{data['date'][8:10]}）</h3></div>
      <div class="info-warning">ユーザー属性データが見つかりませんでした。</div>
    </div>
'''
    html += '  </div>\n'
    return html


def gen_time(data):
    """Generate time analysis section"""
    html = f'''
  <!-- ===== 7. 時間帯分析 ===== -->
  <div id="section-time-{data['tab_key']}" class="tab-content">
'''
    if data.get('hourly'):
        # Sort by clicks desc for display
        sorted_hours = sorted(data['hourly'], key=lambda x: -x['clicks'])
        # Check if there's a gap (hours with 0 clicks late in day)
        zero_hours = [h for h in data['hourly'] if h['clicks'] == 0]
        has_gap = len(zero_hours) > 0

        html += f'''    <div class="section">
      <div class="section-header">
        <h3>時間帯分析（{data['date'][5:7]}/{data['date'][8:10]}）</h3>
        <span class="badge badge-success">確定データ</span>
      </div>
      <table class="data-table">
        <thead>
          <tr><th>時間帯</th><th class="num">クリック数</th><th class="num">表示回数</th><th class="num">平均CPC</th><th class="num">費用</th></tr>
        </thead>
        <tbody>
'''
        for h in sorted_hours:
            if h['clicks'] > 0:
                is_top = h['clicks'] == sorted_hours[0]['clicks']
                bg = ' style="background:var(--primary-light)"' if is_top else ''
                html += f'''          <tr{bg}><td><strong>{h['hour']}</strong></td><td class="num" style="font-weight:700">{h['clicks']}</td><td class="num">{h['impressions']}</td><td class="num">{fmt_yen(h['cpc'])}</td><td class="num">{fmt_yen(h['cost'])}</td></tr>
'''
        # Show zero hours summary
        if zero_hours:
            zero_labels = ', '.join(h['hour'] for h in zero_hours if '時' in h['hour'])
            if len(zero_hours) > 3:
                # Summarize consecutive zero hours
                html += f'''          <tr class="dead-row"><td colspan="5" style="text-align:center;">上記以外の時間帯（{len(zero_hours)}時間帯）はクリック・表示0</td></tr>
'''
            else:
                for h in zero_hours:
                    html += f'''          <tr class="dead-row"><td>{h['hour']}</td><td class="num">0</td><td class="num">0</td><td class="num">—</td><td class="num">&#165;0</td></tr>
'''

        html += '''        </tbody>
      </table>
    </div>
'''
    else:
        html += f'''    <div class="section">
      <div class="section-header"><h3>時間帯分析（{data['date'][5:7]}/{data['date'][8:10]}）</h3></div>
      <div class="info-warning">時間帯データが見つかりませんでした。</div>
    </div>
'''
    html += '  </div>\n'
    return html


def gen_ga4(data):
    """Generate GA4 section with page data if available"""
    date_label = f'{data["date"][5:7]}/{data["date"][8:10]}'
    ga4 = data.get('ga4_pages')

    if not ga4:
        return f'''
  <!-- ===== 8. GA4イベント ===== -->
  <div id="section-ga4-{data['tab_key']}" class="tab-content">
    <div class="section">
      <div class="section-header">
        <h3>GA4 トラフィック獲得データ</h3>
        <span class="badge badge-info">GA4データ未取得</span>
      </div>
      <div class="info-warning">
        {date_label}のGA4データは未取得です。<br>
        GA4管理画面の「トラフィック獲得」レポートからデータを確認してください。
      </div>
    </div>
  </div>
'''

    html = f'''
  <!-- ===== 8. GA4イベント ===== -->
  <div id="section-ga4-{data['tab_key']}" class="tab-content">
    <div class="section">
      <div class="section-header">
        <h3>GA4 ページデータ（{date_label}）</h3>
        <span class="badge badge-success">GA4データ</span>
      </div>
      <table class="data-table">
        <thead><tr><th>ページ</th><th class="num">表示回数</th><th class="num">アクティブユーザー</th><th class="num">平均エンゲージメント時間</th><th class="num">イベント数</th></tr></thead>
        <tbody>
'''
    for p in ga4:
        page_name = 'TOPページ（/）' if p['path'] == '/' else p['path']
        eng_time = f'{p["avg_engagement"]:.1f}秒'
        bg = ' style="background:var(--primary-light)"' if p['path'] == '/' else (' style="background:var(--success-light)"' if '/form' in p['path'] else '')
        html += f'          <tr{bg}><td><strong>{page_name}</strong></td><td class="num" style="font-weight:700">{p["views"]}</td><td class="num">{p["active_users"]}</td><td class="num">{eng_time}</td><td class="num">{p["events"]}</td></tr>\n'

        # Source breakdown
        if p.get('sources'):
            for s in p['sources'][:3]:
                html += f'          <tr><td style="padding-left:28px;color:var(--gray-600);font-size:12px;">↳ {s["source"]}</td><td class="num" style="color:var(--gray-600)">{s["views"]}</td><td class="num" style="color:var(--gray-600)">{s["users"]}</td><td class="num"></td><td class="num"></td></tr>\n'

    html += '''        </tbody>
      </table>
    </div>
  </div>
'''
    return html


def generate_full_section(data, prev_data, cumulative, date):
    """Generate complete date section HTML"""
    html = ''
    html += gen_overview(data, prev_data, cumulative, date)
    html += gen_funnel(data)
    html += gen_heatmap(data)
    html += gen_ads(data, prev_data)
    html += gen_keywords(data)
    html += gen_users(data)
    html += gen_time(data)
    html += gen_ga4(data)
    return html


# ============================================================
# Dashboard Insertion
# ============================================================

def insert_into_dashboard(date, tab_key, tab_label, section_html):
    """Insert new date tab and section into dashboard.html"""
    with open(DASHBOARD_PATH, 'r', encoding='utf-8') as fp:
        html = fp.read()

    m = date.month
    d = date.day

    # 1. Check if this tab already exists → remove it first
    if f'data-date="{tab_key}"' in html:
        print(f'  [!] 日付タブ {tab_label} は既に存在します。上書きします。')
        # Remove existing date-data block (from comment start to closing comment)
        pattern = rf'\n  <!-- ========== {re.escape(tab_label)} DATA ========== -->.*?</div><!-- /date-data {re.escape(tab_key)} -->\n'
        html = re.sub(pattern, '\n', html, flags=re.DOTALL)
        # Remove existing tab button
        html = re.sub(
            rf'\n\s*<button class="date-tab[^"]*" onclick="switchDate\(\'{re.escape(tab_key)}\'\)">[^<]*</button>',
            '', html
        )

    # 2. Make all existing tabs and date-data blocks inactive
    html = html.replace('class="date-tab active"', 'class="date-tab"')
    html = html.replace('class="date-data active"', 'class="date-data"')

    # 3. Add new tab button and sort all tabs by date
    tabs_div_start = html.find('<div class="date-tabs">')
    if tabs_div_start < 0:
        print('  [ERROR] date-tabs が見つかりません')
        return
    tabs_div_end = html.find('</div>', tabs_div_start)
    if tabs_div_end < 0:
        print('  [ERROR] date-tabs の閉じタグが見つかりません')
        return
    # Extract existing tab buttons and add the new one
    tabs_block = html[tabs_div_start:tabs_div_end]
    existing_tabs = re.findall(r'<button class="date-tab[^"]*" onclick="switchDate\(\'([^\']+)\'\)">([^<]+)</button>', tabs_block)
    # Add new tab
    all_tabs = [(k, l) for k, l in existing_tabs if k != tab_key]
    all_tabs.append((tab_key, tab_label))
    # Sort: "20-21" → (2,20), "22" → (2,22), "1" → (3,1), etc.
    def tab_sort_key(t):
        key = t[0]
        if '-' in key:  # "20-21" → use first number
            num = int(key.split('-')[0])
        else:
            num = int(key)
        # Determine month from label
        label = t[1]
        if '/' in label:
            month = int(label.split('/')[0])
        else:
            month = m if num <= 31 else m
        return (month, num)
    all_tabs.sort(key=tab_sort_key)
    # Rebuild tabs HTML
    tabs_html = '\n'.join(
        f'    <button class="date-tab{" active" if k == tab_key else ""}" onclick="switchDate(\'{k}\')">{l}</button>'
        for k, l in all_tabs
    )
    html = html[:tabs_div_start] + '<div class="date-tabs">\n' + tabs_html + '\n  ' + html[tabs_div_end:]

    # 4. Add the date section data BEFORE the first existing date-data block
    new_section = f'''  <!-- ========== {tab_label} DATA ========== -->
  <div class="date-data active" data-date="{tab_key}">

{section_html}
  </div><!-- /date-data {tab_key} -->

'''
    # Find the first <!-- ========== ... DATA ========== --> comment
    first_data_comment = re.search(r'  <!-- ========== .+ DATA ========== -->', html)
    if first_data_comment:
        insert_pos = first_data_comment.start()
        html = html[:insert_pos] + new_section + html[insert_pos:]
    else:
        print('  [ERROR] 既存のdate-dataブロックが見つかりません')
        return

    # 5. Update JavaScript currentDate
    html = re.sub(r"let currentDate = '[^']+';", f"let currentDate = '{tab_key}';", html)

    # 6. Update sidebar footer
    today_str = datetime.now().strftime('%Y/%m/%d')
    html = re.sub(r'最終更新: \d{4}/\d{2}/\d{2}', f'最終更新: {today_str}', html)
    html = re.sub(r'データ期間: [^\n<]+', f'データ期間: 2/20〜{m}/{d}', html)

    # 7. Update top bar last update
    html = re.sub(
        r'日付タブで切り替え \| 最終更新: \d{4}/\d{2}/\d{2}',
        f'日付タブで切り替え | 最終更新: {today_str}',
        html
    )

    # 8. Write back
    with open(DASHBOARD_PATH, 'w', encoding='utf-8') as fp:
        fp.write(html)

    print(f'  [OK] dashboard.html を更新しました')


# ============================================================
# Main
# ============================================================

def run_from_json(json_path):
    """Run dashboard update from a pre-built JSON file (no CSV needed)"""
    if not os.path.exists(json_path):
        print(f'エラー: JSONファイルが見つかりません: {json_path}')
        sys.exit(1)

    print(f'=== ニコニコカーローン ダッシュボード更新（JSONモード） ===')
    print(f'  JSONファイル: {json_path}')
    print()

    # Load JSON data
    print('[1/4] JSONファイルを読み込み中...')
    with open(json_path, encoding='utf-8') as fp:
        data = json.load(fp)

    date = datetime.strptime(data['date'], '%Y-%m-%d')
    m = date.month
    d = date.day
    tab_key = data.get('tab_key', str(d))
    tab_label = f'{m}/{d}'

    print(f'  日付: {date.strftime("%Y/%m/%d")} ({tab_label})')
    c = data['campaign']
    print(f'  費用: ¥{c["cost"]:,} | クリック: {c["clicks"]} | 表示: {c["impressions"]}')
    print(f'  CTR: {c["ctr"]:.2f}% | CPC: ¥{c["cpc"]} | CV: {c["cv"]:.0f}')
    print()

    # Save to data/ dir if not already there
    expected_path = os.path.join(DATA_DIR, f'{data["date"]}.json')
    if os.path.abspath(json_path) != os.path.abspath(expected_path):
        os.makedirs(DATA_DIR, exist_ok=True)
        with open(expected_path, 'w', encoding='utf-8') as fp:
            json.dump(data, fp, ensure_ascii=False, indent=2)
        print(f'  データコピー先: {expected_path}')

    # Load previous day data
    print('[2/4] 前日データを読み込み中...')
    prev_data = find_previous_day(date)
    if prev_data:
        print(f'  前日: {prev_data["date"]}')
    else:
        print('  前日データなし（比較テーブルはスキップ）')
    print()

    # Calculate cumulative
    print('[3/4] 累計データを計算中...')
    all_data = load_all_daily_data()
    if all_data:
        cum_cost = sum(d['campaign']['cost'] for d in all_data)
        cum_clicks = sum(d['campaign']['clicks'] for d in all_data)
        cum_imp = sum(d['campaign']['impressions'] for d in all_data)
        cum_cv = sum(d['campaign']['cv'] for d in all_data)
        first_date = all_data[0]['date']
        last_date = all_data[-1]['date']
        cumulative = {
            'days': len(all_data),
            'period': f'{first_date[5:7]}/{first_date[8:10]}〜{last_date[5:7]}/{last_date[8:10]}',
            'cost': cum_cost,
            'clicks': cum_clicks,
            'impressions': cum_imp,
            'ctr': (cum_clicks / cum_imp * 100) if cum_imp > 0 else 0,
            'cpc': (cum_cost // cum_clicks) if cum_clicks > 0 else 0,
            'cv': cum_cv,
            'cvr': (cum_cv / cum_clicks * 100) if cum_clicks > 0 else 0,
            'cpa': (cum_cost // cum_cv) if cum_cv > 0 else 0,
        }
        print(f'  {cumulative["days"]}日間: ¥{cum_cost:,} | {cum_clicks}クリック | CV {cum_cv:.0f}件')
    else:
        cumulative = None
        print('  累計データなし')
    print()

    # Generate HTML
    print('[4/4] HTMLを生成してダッシュボードに挿入中...')
    section_html = generate_full_section(data, prev_data, cumulative, date)
    insert_into_dashboard(date, tab_key, tab_label, section_html)

    print()
    print('=== 完了! ===')
    print(f'  dashboard.html に {tab_label} のタブを追加しました。')


def main():
    if len(sys.argv) < 2:
        print('使い方: python3 update_dashboard.py /path/to/csv/folder')
        print('        python3 update_dashboard.py --from-json data/2026-03-01.json')
        print()
        print('例:')
        print('  python3 update_dashboard.py ~/Downloads/概要カード_csv(2026-02-25_10_22_53)')
        print('  python3 update_dashboard.py --from-json data/2026-02-28.json')
        sys.exit(1)

    # --from-json mode
    if sys.argv[1] == '--from-json':
        if len(sys.argv) < 3:
            print('エラー: --from-json にはJSONファイルパスが必要です')
            sys.exit(1)
        run_from_json(sys.argv[2])
        return

    csv_dir = sys.argv[1]
    if not os.path.isdir(csv_dir):
        print(f'エラー: ディレクトリが見つかりません: {csv_dir}')
        sys.exit(1)

    # Detect date
    date = detect_date(csv_dir)
    if not date:
        print('エラー: CSVファイルから日付を検出できませんでした')
        sys.exit(1)

    m = date.month
    d = date.day
    tab_key = str(d)
    tab_label = f'{m}/{d}'

    print(f'=== ニコニコカーローン ダッシュボード更新 ===')
    print(f'  日付: {date.strftime("%Y/%m/%d")} ({tab_label})')
    print(f'  CSVフォルダ: {csv_dir}')
    print()

    # Parse all CSVs
    print('[1/5] CSVファイルを読み込み中...')
    campaign = parse_campaign(csv_dir)
    adgroups = parse_adgroups(csv_dir)
    keywords = parse_keywords(csv_dir)
    search_terms = parse_search_terms(csv_dir)
    hourly = parse_hourly(csv_dir)
    devices = parse_devices(csv_dir)
    network = parse_network(csv_dir)
    gender = parse_gender(csv_dir)
    age = parse_age(csv_dir)
    opt_score = parse_optimization_score(csv_dir)
    clarity = parse_clarity_dashboard(csv_dir)
    clarity_scroll = parse_clarity_scroll(csv_dir)
    ga4_pages = parse_ga4_pages(csv_dir)

    if not campaign:
        print('エラー: キャンペーンCSVが見つかりません')
        sys.exit(1)

    # Build campaign data from both sources
    total = adgroups['total'] if adgroups else None
    campaign_data = {
        'name': campaign['name'],
        'cost': total['cost'] if total else campaign['cost'],
        'clicks': total['clicks'] if total else campaign['clicks'],
        'impressions': total['impressions'] if total else 0,
        'ctr': total['ctr'] if total else campaign['ctr'],
        'cpc': total['cpc'] if total else (campaign['cost'] // campaign['clicks'] if campaign['clicks'] > 0 else 0),
        'cv': total['cv'] if total else 0,
        'cvr': total['cvr'] if total else 0,
        'cpa': total['cpa'] if total else 0,
        'optimization_score': opt_score or 0,
    }

    print(f'  キャンペーン: {campaign_data["name"]}')
    print(f'  費用: ¥{campaign_data["cost"]:,} | クリック: {campaign_data["clicks"]} | 表示: {campaign_data["impressions"]}')
    print(f'  CTR: {campaign_data["ctr"]:.2f}% | CPC: ¥{campaign_data["cpc"]} | CV: {campaign_data["cv"]:.0f}')
    print(f'  広告グループ: {len(adgroups["groups"]) if adgroups else 0}件')
    print(f'  キーワード: {len(keywords) if keywords else 0}件')
    print(f'  時間帯: {len(hourly) if hourly else 0}件')
    print(f'  デバイス: {len(devices) if devices else 0}件')
    print(f'  ネットワーク: {len(network) if network else 0}件')
    print(f'  性別: {len(gender) if gender else 0}件 | 年齢: {len(age) if age else 0}件')
    print(f'  Clarity: {"あり" if clarity else "なし"} | Clarityスクロール: {"あり" if clarity_scroll else "なし"} | GA4: {"あり" if ga4_pages else "なし"}')
    print()

    # Build data object
    data = {
        'date': date.strftime('%Y-%m-%d'),
        'tab_key': tab_key,
        'campaign': campaign_data,
        'adgroups': adgroups,
        'keywords': keywords,
        'search_terms': search_terms,
        'hourly': hourly,
        'devices': devices,
        'network': network,
        'gender': gender,
        'age': age,
        'clarity': clarity,
        'clarity_scroll': clarity_scroll,
        'ga4_pages': ga4_pages,
    }

    # Save daily data
    print('[2/5] データをJSONに保存中...')
    json_path = save_daily_data(date, data)
    print(f'  保存先: {json_path}')
    print()

    # Load previous day data
    print('[3/5] 前日データを読み込み中...')
    prev_data = find_previous_day(date)
    if prev_data:
        print(f'  前日: {prev_data["date"]}')
    else:
        print('  前日データなし（比較テーブルはスキップ）')
    print()

    # Calculate cumulative
    print('[4/5] 累計データを計算中...')
    all_data = load_all_daily_data()
    if all_data:
        cum_cost = sum(d['campaign']['cost'] for d in all_data)
        cum_clicks = sum(d['campaign']['clicks'] for d in all_data)
        cum_imp = sum(d['campaign']['impressions'] for d in all_data)
        cum_cv = sum(d['campaign']['cv'] for d in all_data)
        first_date = all_data[0]['date']
        last_date = all_data[-1]['date']
        cumulative = {
            'days': len(all_data),
            'period': f'{first_date[5:7]}/{first_date[8:10]}〜{last_date[5:7]}/{last_date[8:10]}',
            'cost': cum_cost,
            'clicks': cum_clicks,
            'impressions': cum_imp,
            'ctr': (cum_clicks / cum_imp * 100) if cum_imp > 0 else 0,
            'cpc': (cum_cost // cum_clicks) if cum_clicks > 0 else 0,
            'cv': cum_cv,
            'cvr': (cum_cv / cum_clicks * 100) if cum_clicks > 0 else 0,
            'cpa': (cum_cost // cum_cv) if cum_cv > 0 else 0,
        }
        print(f'  {cumulative["days"]}日間: ¥{cum_cost:,} | {cum_clicks}クリック | CV {cum_cv:.0f}件')
    else:
        cumulative = None
        print('  累計データなし')
    print()

    # Generate HTML
    print('[5/5] HTMLを生成してダッシュボードに挿入中...')
    section_html = generate_full_section(data, prev_data, cumulative, date)
    insert_into_dashboard(date, tab_key, tab_label, section_html)

    print()
    print('=== 完了! ===')
    print(f'  dashboard.html に {tab_label} のタブを追加しました。')
    print(f'  ブラウザで dashboard.html を開いて確認してください。')


if __name__ == '__main__':
    main()
