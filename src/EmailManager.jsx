import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Trash2,
  ExternalLink,
  Search,
  RotateCcw,
  Inbox,
  Clock3,
  CheckCircle2,
  Copy,
  Check,
  Download,
  Trash,
  Pin,
  PinOff,
  X,
  Maximize2,
} from 'lucide-react';

const STORAGE_KEY = 'email-entries-v1';
const RESET_HOURS = 24;

function formatElapsed(ms) {
  if (!ms || ms < 0) return '刚刚';

  const totalMinutes = Math.floor(ms / 60000);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h <= 0 && m <= 0) return '刚刚';
  if (h <= 0) return `${m} 分钟`;
  return `${h} 小时 ${m} 分钟`;
}

function formatDateTime(ts) {
  if (!ts) return '—';

  const d = new Date(ts);

  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function parsePaste(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line
        .split(/\t|,\s*/)
        .map((p) => p.trim())
        .filter((p) => p !== '');

      const third = parts[2] || '';
      const looksLikeProfile = /^profile\s*\d+$/i.test(third);

      return {
        email: parts[0] || '',
        browser: parts[1] || '',
        profile: looksLikeProfile ? third : '',
        customId: looksLikeProfile ? parts[3] || '' : third,
      };
    })
    .filter((row) => row.email);
}

function getEffectiveStatus(entry) {
  if (entry.status === 'used' && entry.usedAt) {
    const elapsed = Date.now() - entry.usedAt;

    if (elapsed >= RESET_HOURS * 3600000) {
      return 'available';
    }
  }

  return entry.status;
}

export default function EmailManager() {
  const isToolbar =
    new URLSearchParams(window.location.search).get('toolbar') === '1';

  const [entries, setEntries] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [search, setSearch] = useState('');
  const [message, setMessage] = useState('');
  const [, forceTick] = useState(0);
  const [copiedId, setCopiedId] = useState(null);
  const [manualCopyEntry, setManualCopyEntry] = useState(null);
  const [toolbarPinned, setToolbarPinned] = useState(true);

  const messageTimer = useRef(null);
  const copyTimer = useRef(null);
  const manualInputRef = useRef(null);

  // 防止窗口之间同步数据时再次触发保存/广播
  const syncingRef = useRef(false);

  // 防止首次读取数据时触发保存
  const initialLoadRef = useRef(true);

  // ============================================================
  // Load
  // ============================================================

  useEffect(() => {
    async function load() {
      try {
        if (window.emailManager?.loadEmailData) {
          const result = await window.emailManager.loadEmailData();

          if (result?.ok && Array.isArray(result.data)) {
            setEntries(result.data);
          }
        } else {
          const value = localStorage.getItem(STORAGE_KEY);

          if (value) {
            setEntries(JSON.parse(value));
          }
        }
      } catch (error) {
        console.error('读取邮箱数据失败:', error);
      } finally {
        setLoaded(true);
      }
    }

    load();
  }, []);

  // ============================================================
  // Save
  // ============================================================

  useEffect(() => {
  if (!loaded) return;

  // 首次读取磁盘数据时，不重新保存
  if (initialLoadRef.current) {
    initialLoadRef.current = false;
    return;
  }

  // 如果这次数据来自另一个窗口
  // 只更新界面，不再次保存/广播
  if (syncingRef.current) {
    syncingRef.current = false;
    return;
  }

  async function save() {
    try {

      if (window.emailManager?.saveEmailData) {

        await window.emailManager.saveEmailData(
          entries
        );

      } else {

        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify(entries)
        );

      }

    } catch (error) {

      console.error(
        '保存邮箱数据失败:',
        error
      );

    }
  }

  save();

}, [entries, loaded]);

  // ============================================================
  // Receive data from other window
  // ============================================================

  useEffect(() => {
  if (!window.emailManager?.onEmailDataUpdated) return;

  const removeListener =
    window.emailManager.onEmailDataUpdated((data) => {

      if (!Array.isArray(data)) return;

      // 标记：这次数据来自另一个窗口
      // 接下来不要再次保存并广播
      syncingRef.current = true;

      setEntries(data);
    });

  return () => {
    if (typeof removeListener === 'function') {
      removeListener();
    }
  };
}, []);

  // ============================================================
  // Clock
  // ============================================================

  useEffect(() => {
    const id = setInterval(() => {
      forceTick((t) => t + 1);
    }, 30000);

    return () => clearInterval(id);
  }, []);

  // ============================================================
  // Message
  // ============================================================

  const showMessage = useCallback((text) => {
    setMessage(text);

    if (messageTimer.current) {
      clearTimeout(messageTimer.current);
    }

    messageTimer.current = setTimeout(() => {
      setMessage('');
    }, 2500);
  }, []);

  // ============================================================
  // Open browser
  // ============================================================

  const openEntry = async (entry) => {
    const effective = getEffectiveStatus(entry);

    if (effective !== 'available') {
      return;
    }

    const url = entry.email.startsWith('http')
      ? entry.email
      : `https://${entry.email}`;

    const browser = (entry.browser || 'Chrome').trim();

    const supported = /^(chrome|edge|brave)$/i.test(browser);

    if (
      supported &&
      entry.profile &&
      window.emailManager?.openBrowserProfile
    ) {
      const result =
        await window.emailManager.openBrowserProfile(
          browser,
          entry.profile,
          url
        );

      if (!result?.ok) {
        showMessage(
          `打开失败：${result?.error || '未知错误'}`
        );
        return false;
      }
    } else {
      window.open(
        url,
        '_blank',
        'noopener,noreferrer'
      );
    }

    setEntries((prev) =>
      prev.map((item) =>
        item.id === entry.id
          ? {
              ...item,
              status: 'used',
              usedAt: Date.now(),
            }
          : item
      )
    );

    showMessage('已打开并标记为已使用');

    return true;
  };

  // ============================================================
  // Add
  // ============================================================

  const handleAdd = () => {
    const rows = parsePaste(pasteText);

    if (rows.length === 0) {
      showMessage('没有识别到有效数据');
      return;
    }

    const existingEmails = new Set(
      entries.map((e) => e.email.toLowerCase())
    );

    let added = 0;
    let skipped = 0;

    const newEntries = [];

    rows.forEach((row, i) => {
      const emailKey = row.email.toLowerCase();

      if (existingEmails.has(emailKey)) {
        skipped++;
        return;
      }

      existingEmails.add(emailKey);
      added++;

      newEntries.push({
        id:
          typeof crypto !== 'undefined' &&
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${i}`,

        displayId:
          row.customId ||
          String(entries.length + newEntries.length + 1),

        email: row.email,

        browser: row.browser || 'Chrome',

        profile: row.profile || '',

        status: 'available',

        usedAt: null,
      });
    });

    setEntries((prev) => [
      ...prev,
      ...newEntries,
    ]);

    setPasteText('');

    showMessage(
      `已添加 ${added} 个${
        skipped
          ? `，跳过 ${skipped} 个重复邮箱`
          : ''
      }`
    );
  };

  // ============================================================
  // Revert
  // ============================================================

  const handleRevert = (id) => {
    setEntries((prev) =>
      prev.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              status: 'available',
              usedAt: null,
            }
          : entry
      )
    );
  };

  // ============================================================
  // Delete
  // ============================================================

  const handleDelete = (id) => {
    setEntries((prev) =>
      prev.filter((entry) => entry.id !== id)
    );
  };

  // ============================================================
  // Clear all
  // ============================================================

  const handleClearAll = () => {
    if (entries.length === 0) {
      showMessage('当前没有邮箱');
      return;
    }

    const confirmed = window.confirm(
      `确定要清空全部 ${entries.length} 个邮箱吗？\n\n清空后可以重新导入新的一批邮箱。`
    );

    if (!confirmed) return;

    setEntries([]);

    showMessage('已清空全部邮箱');
  };

  // ============================================================
  // Copy
  // ============================================================

  const copyText = async (text) => {
    try {
      if (
        navigator.clipboard &&
        window.isSecureContext
      ) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {}

    try {
      const textarea =
        document.createElement('textarea');

      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';

      document.body.appendChild(textarea);

      textarea.focus();
      textarea.select();

      const ok =
        document.execCommand('copy');

      textarea.remove();

      return ok;
    } catch {
      return false;
    }
  };

  const handleCopy = async (entry) => {
    const ok = await copyText(entry.email);

    if (ok) {
      setCopiedId(entry.id);

      if (copyTimer.current) {
        clearTimeout(copyTimer.current);
      }

      copyTimer.current = setTimeout(() => {
        setCopiedId(null);
      }, 1500);
    } else {
      setManualCopyEntry(entry);
    }
  };

  // ============================================================
  // Export
  // ============================================================

  const handleExport = async () => {
    if (entries.length === 0) {
      showMessage('没有可以导出的邮箱');
      return;
    }

    if (window.emailManager?.exportEmailData) {
      const result =
        await window.emailManager.exportEmailData(
          entries
        );

      if (result?.ok) {
        showMessage('导出成功');
      } else if (!result?.canceled) {
        showMessage(
          `导出失败：${result?.error || '未知错误'}`
        );
      }

      return;
    }

    // fallback
    const header =
      '编号,邮箱链接,浏览器,Profile,使用时间,状态';

    const rows = entries.map((entry) => {
      const status =
        getEffectiveStatus(entry) === 'used'
          ? '已使用'
          : '可用';

      return [
        entry.displayId,
        entry.email,
        entry.browser,
        entry.profile,
        entry.usedAt
          ? formatDateTime(entry.usedAt)
          : '',
        status,
      ]
        .map((value) =>
          `"${String(value).replace(/"/g, '""')}"`
        )
        .join(',');
    });

    const blob =
      new Blob(
        [
          '\uFEFF' +
            [header, ...rows].join('\r\n'),
        ],
        {
          type: 'text/csv;charset=utf-8;',
        }
      );

    const url =
      URL.createObjectURL(blob);

    const a =
      document.createElement('a');

    a.href = url;
    a.download =
      `email-manager-${new Date()
        .toISOString()
        .slice(0, 10)}.csv`;

    a.click();

    URL.revokeObjectURL(url);

    showMessage('导出成功');
  };

  // ============================================================
  // Toolbar
  // ============================================================

  const handleToolbarPin = async () => {
    const next = !toolbarPinned;

    setToolbarPinned(next);

    if (window.emailManager?.setToolbarAlwaysOnTop) {
      await window.emailManager.setToolbarAlwaysOnTop(
        next
      );
    }
  };

  const closeToolbar = async () => {
    if (window.emailManager?.closeToolbar) {
      await window.emailManager.closeToolbar();
    } else {
      window.close();
    }
  };

  const openMainWindow = async () => {
    if (window.emailManager?.openMainWindow) {
      await window.emailManager.openMainWindow();
    }
  };

  // ============================================================
  // Filter
  // ============================================================

  const filtered = entries.filter((entry) => {
    const q = search.trim().toLowerCase();

    if (!q) return true;

    return (
      entry.email
        .toLowerCase()
        .includes(q) ||
      (entry.browser || '')
        .toLowerCase()
        .includes(q) ||
      String(entry.displayId)
        .toLowerCase()
        .includes(q)
    );
  });

  const availableEntries = entries.filter(
    (entry) =>
      getEffectiveStatus(entry) === 'available'
  );

  const total = entries.length;

  const usedCount = entries.filter(
    (entry) =>
      getEffectiveStatus(entry) === 'used'
  ).length;

  const availableCount =
    total - usedCount;

  // ============================================================
  // TOOLBAR UI
  // ============================================================

  if (isToolbar) {
    return (
      <div className="h-screen w-screen bg-slate-950 text-slate-100 font-sans overflow-hidden flex flex-col">
        {/* Toolbar header */}
        <div className="h-10 shrink-0 flex items-center justify-between px-3 border-b border-slate-800 bg-slate-900">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold text-slate-200">
              邮箱快捷栏
            </span>

            <span className="text-[10px] text-teal-400 font-mono">
              {availableEntries.length} 可用
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={openMainWindow}
              title="打开完整管理窗口"
              className="p-1.5 text-slate-500 hover:text-teal-400"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleToolbarPin}
              title={
                toolbarPinned
                  ? '取消置顶'
                  : '始终置顶'
              }
              className="p-1.5 text-slate-500 hover:text-teal-400"
            >
              {toolbarPinned ? (
                <Pin className="w-3.5 h-3.5" />
              ) : (
                <PinOff className="w-3.5 h-3.5" />
              )}
            </button>

            <button
              onClick={closeToolbar}
              title="关闭快捷栏"
              className="p-1.5 text-slate-500 hover:text-red-400"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Available emails */}
        <div className="flex-1 overflow-y-auto p-2">
          {availableEntries.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-600">
              <CheckCircle2 className="w-6 h-6 mb-2" />
              <span className="text-xs">
                当前没有可用邮箱
              </span>
            </div>
          ) : (
            <div className="space-y-1">
              {availableEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-md px-2 py-1.5 hover:bg-slate-800/80"
                >
                  <span className="w-7 shrink-0 text-[11px] font-mono text-slate-500">
                    {entry.displayId}
                  </span>

                  <button
                    onClick={() =>
                      openEntry(entry)
                    }
                    className="flex-1 min-w-0 text-left"
                    title={`${entry.email}\n${entry.browser} ${entry.profile}`}
                  >
                    <div className="truncate text-xs text-slate-300 hover:text-teal-400">
                      {entry.email}
                    </div>

                    <div className="truncate text-[10px] text-slate-600">
                      {entry.browser}
                      {entry.profile
                        ? ` · ${entry.profile}`
                        : ''}
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      openEntry(entry)
                    }
                    className="shrink-0 bg-teal-500 hover:bg-teal-400 text-slate-950 text-[11px] font-semibold px-2.5 py-1 rounded"
                  >
                    使用
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // MAIN WINDOW
  // ============================================================

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans">
      <div className="max-w-6xl mx-auto px-4 py-7">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
              邮箱账号管理
            </h1>

            <p className="text-sm text-slate-400 mt-1">
              粘贴表格批量导入 · 使用后 {RESET_HOURS} 小时自动恢复可用
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                window.emailManager?.openToolbar?.()
              }
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-md"
            >
              <Pin className="w-4 h-4" />
              打开快捷栏
            </button>

            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm px-3 py-2 rounded-md"
            >
              <Download className="w-4 h-4" />
              导出
            </button>

            <button
              onClick={handleClearAll}
              className="inline-flex items-center gap-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm px-3 py-2 rounded-md"
            >
              <Trash className="w-4 h-4" />
              全部清空
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">
              总数
            </div>

            <div className="text-xl font-mono text-slate-100">
              {total}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">
              可用
            </div>

            <div className="text-xl font-mono text-teal-400">
              {availableCount}
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-lg px-4 py-3">
            <div className="text-xs text-slate-500 mb-1">
              使用中
            </div>

            <div className="text-xl font-mono text-amber-400">
              {usedCount}
            </div>
          </div>
        </div>

        {/* Import */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-slate-200">
              批量添加
            </span>

            <span className="text-xs text-slate-500">
              邮箱 [Tab] 浏览器 [Tab] Profile [Tab] 编号
            </span>
          </div>

          <textarea
            value={pasteText}
            onChange={(e) =>
              setPasteText(e.target.value)
            }
            placeholder={
              'email@example.com\tChrome\tProfile 43\t001\nemail@example.com\tEdge\tProfile 5\t002'
            }
            rows={4}
            className="w-full bg-slate-950 border border-slate-800 rounded-md px-3 py-2 text-sm font-mono text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50 resize-y"
          />

          <div className="flex items-center justify-between mt-3">
            <span className="text-xs text-teal-400 h-4">
              {message}
            </span>

            <button
              onClick={handleAdd}
              className="bg-teal-500 hover:bg-teal-400 text-slate-950 text-sm font-medium px-4 py-1.5 rounded-md"
            >
              导入
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />

          <input
            value={search}
            onChange={(e) =>
              setSearch(e.target.value)
            }
            placeholder="搜索邮箱 / 浏览器 / 编号"
            className="w-full bg-slate-900 border border-slate-800 rounded-md pl-9 pr-3 py-2 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-teal-500/50"
          />
        </div>

        {/* Table */}
        <div className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-600">
              <Inbox className="w-8 h-8 mb-2" />

              <span className="text-sm">
                {total === 0
                  ? '还没有添加任何账号，请先批量导入'
                  : '没有匹配的结果'}
              </span>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-500 text-xs">
                    <th className="text-left font-normal px-4 py-2 w-16">
                      编号
                    </th>

                    <th className="text-left font-normal px-4 py-2">
                      邮箱链接
                    </th>

                    <th className="text-left font-normal px-4 py-2 w-24">
                      浏览器
                    </th>

                    <th className="text-left font-normal px-4 py-2 w-28">
                      Profile
                    </th>

                    <th className="text-left font-normal px-4 py-2 w-36">
                      使用时间
                    </th>

                    <th className="text-left font-normal px-4 py-2 w-40">
                      已用时长
                    </th>

                    <th className="text-left font-normal px-4 py-2 w-28">
                      状态
                    </th>

                    <th className="px-4 py-2 w-10" />
                  </tr>
                </thead>

                <tbody>
                  {filtered.map((entry) => {
                    const status =
                      getEffectiveStatus(entry);

                    const isUsed =
                      status === 'used';

                    const elapsedMs =
                      entry.usedAt
                        ? Date.now() -
                          entry.usedAt
                        : 0;

                    const progress = isUsed
                      ? Math.min(
                          100,
                          (elapsedMs /
                            (RESET_HOURS *
                              3600000)) *
                            100
                        )
                      : 0;

                    return (
                      <tr
                        key={entry.id}
                        className="border-b border-slate-800/60 last:border-0 hover:bg-slate-800/30"
                      >
                        <td className="px-4 py-3 font-mono text-slate-400">
                          {entry.displayId}
                        </td>

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <a
                              href={
                                entry.email.startsWith(
                                  'http'
                                )
                                  ? entry.email
                                  : `https://${entry.email}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="font-mono text-slate-200 hover:text-teal-400 inline-flex items-center gap-1 break-all"
                            >
                              {entry.email}

                              <ExternalLink className="w-3 h-3 shrink-0 opacity-50" />
                            </a>

                            <button
                              onClick={() =>
                                handleCopy(entry)
                              }
                              className="shrink-0 text-slate-600 hover:text-teal-400"
                            >
                              {copiedId ===
                              entry.id ? (
                                <Check className="w-3.5 h-3.5 text-teal-400" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>
                          </div>
                        </td>

                        <td className="px-4 py-3 text-slate-400">
                          {entry.browser}
                        </td>

                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {entry.profile || '—'}
                        </td>

                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                          {isUsed
                            ? formatDateTime(
                                entry.usedAt
                              )
                            : '—'}
                        </td>

                        <td className="px-4 py-3">
                          {isUsed ? (
                            <div className="flex flex-col gap-1">
                              <span className="text-xs text-slate-400 font-mono">
                                {formatElapsed(
                                  elapsedMs
                                )}
                              </span>

                              <div className="h-1 w-full bg-slate-800 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    progress > 80
                                      ? 'bg-amber-400'
                                      : 'bg-teal-500'
                                  }`}
                                  style={{
                                    width: `${progress}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ) : (
                            <span className="text-xs text-slate-600">
                              —
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              openEntry(entry)
                            }
                            disabled={isUsed}
                            className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-md ${
                              isUsed
                                ? 'bg-amber-500/10 text-amber-400 cursor-default'
                                : 'bg-teal-500 text-slate-950 hover:bg-teal-400'
                            }`}
                          >
                            {isUsed ? (
                              <>
                                <Clock3 className="w-3.5 h-3.5" />
                                已使用
                              </>
                            ) : (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                使用
                              </>
                            )}
                          </button>

                          {isUsed && (
                            <button
                              onClick={() =>
                                handleRevert(
                                  entry.id
                                )
                              }
                              className="mt-1 flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-300"
                            >
                              <RotateCcw className="w-3 h-3" />
                              撤销
                            </button>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <button
                            onClick={() =>
                              handleDelete(
                                entry.id
                              )
                            }
                            className="text-slate-600 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Manual copy */}
      {manualCopyEntry && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center px-4 z-50"
          onClick={() =>
            setManualCopyEntry(null)
          }
        >
          <div
            className="bg-slate-900 border border-slate-700 rounded-lg p-5 w-full max-w-md"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="text-sm font-medium text-slate-200 mb-1">
              自动复制不可用
            </div>

            <div className="text-xs text-slate-500 mb-3">
              已为你选中下面的邮箱，按 Ctrl+C 手动复制。
            </div>

            <input
              ref={manualInputRef}
              readOnly
              value={manualCopyEntry.email}
              onFocus={(e) =>
                e.target.select()
              }
              className="w-full bg-slate-950 border border-slate-700 rounded-md px-3 py-2 text-sm font-mono text-slate-200"
            />

            <div className="flex justify-end mt-3">
              <button
                onClick={() =>
                  setManualCopyEntry(null)
                }
                className="text-xs text-slate-400 hover:text-slate-200 px-3 py-1.5"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}