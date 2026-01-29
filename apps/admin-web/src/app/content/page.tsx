'use client';

import { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout';
import { Card, CardContent, Button } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { api, Content, ContentUnit, RawContent, Topic } from '@/lib/api';

type ViewMode = 'contents' | 'raws' | 'units' | 'topics';

export default function ContentPage() {
    const { token } = useAuth();
    const [viewMode, setViewMode] = useState<ViewMode>('raws'); // Default to 'raws'
    const [items, setItems] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [rawContentIdFilter, setRawContentIdFilter] = useState<string | null>(null); // For filtering units by parent

    useEffect(() => {
        if (token) {
            loadData();
        }
    }, [token, viewMode, statusFilter, rawContentIdFilter]);

    // Reset filters when switching main tabs
    const handleTabChange = (mode: ViewMode) => {
        setItems([]);
        setViewMode(mode);
        setStatusFilter('');
        setRawContentIdFilter(null);
    };

    const handleViewUnitsForRaw = (rawId: string) => {
        setItems([]);
        setRawContentIdFilter(rawId);
        setViewMode('units');
    };

    async function loadData() {
        if (!token) return;

        setIsLoading(true);
        setItems([]);
        try {
            let response: any;
            if (viewMode === 'contents') {
                response = await api.getContents(token, {
                    limit: 50,
                    status: statusFilter || undefined,
                });
            } else if (viewMode === 'raws') {
                response = await api.getRawContents(token, {
                    limit: 50,
                    status: statusFilter || undefined,
                });
            } else if (viewMode === 'units') {
                response = await api.getContentUnits(token, {
                    limit: 50,
                    rawContentId: rawContentIdFilter || undefined,
                    // Quality score filter could be added here
                });
            } else if (viewMode === 'topics') {
                response = await api.getTopics(token, {
                    limit: 50,
                    activeOnly: true,
                });
            }

            if (response) {
                setItems(response.items);
                setTotal(response.total);
            }
        } catch (error) {
            console.error(`Failed to load ${viewMode}:`, error);
        } finally {
            setIsLoading(false);
        }
    }

    const statuses = ['pending', 'parsing', 'parsed', 'ai_analyzing', 'ai_analyzed', 'vectorizing', 'ready', 'error'];
    const tabs: { id: ViewMode; label: string }[] = [
        { id: 'raws', label: 'Raws' },
        { id: 'units', label: 'Units' },
        { id: 'topics', label: 'Topics' },
    ];

    return (
        <DashboardLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-white tracking-tight">Content Explorer</h1>
                            <p className="mt-1 text-slate-400">Manage and analyze your content pipeline ({total} total)</p>
                        </div>
                    </div>

                    {/* View Tabs */}
                    <div className="flex items-center gap-1 border-b border-slate-800">
                        {tabs.map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                className={`px-6 py-3 text-sm font-medium rounded-t-lg transition-all relative ${viewMode === tab.id
                                    ? 'text-indigo-400 bg-indigo-500/10 border-b-2 border-indigo-500'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/30'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800/60 backdrop-blur-md">

                    {/* Status Filter for Raws/Contents */}
                    {(viewMode === 'contents' || viewMode === 'raws') && (
                        <>
                            <span className="text-sm font-medium text-slate-400">Filter by Status:</span>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all hover:bg-slate-800"
                            >
                                <option value="">All Statuses</option>
                                {statuses.map((status) => (
                                    <option key={status} value={status}>{status.toUpperCase()}</option>
                                ))}
                            </select>
                        </>
                    )}

                    {/* Active Filter for Units (showing parent context) */}
                    {viewMode === 'units' && rawContentIdFilter && (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-lg text-sm border border-indigo-500/30">
                            <span>Filtered by Raw ID: {rawContentIdFilter.substring(0, 8)}...</span>
                            <button onClick={() => setRawContentIdFilter(null)} className="hover:text-white">✕</button>
                        </div>
                    )}

                    <div className="flex-1"></div>
                    <Button onClick={() => loadData()} variant="secondary" className="bg-indigo-600 hover:bg-indigo-500 text-white border-none shadow-lg shadow-indigo-500/20">
                        Refresh
                    </Button>
                </div>

                {/* Content Grid */}
                {isLoading ? (
                    <div className="flex items-center justify-center py-24">
                        <div className="relative">
                            <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 animate-pulse rounded-full"></div>
                            <svg className="relative animate-spin h-10 w-10 text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                        </div>
                    </div>
                ) : items.length === 0 ? (
                    <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-dashed border-slate-700/50 bg-slate-900/20">
                        <h3 className="text-xl font-medium text-slate-300">No {viewMode} found</h3>
                        <p className="mt-2 text-slate-500">Try changing filters or wait for the sync.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-6">
                        {viewMode === 'raws' && items.map((raw) => (
                            <RawContentCard key={raw.id} raw={raw} onViewUnits={handleViewUnitsForRaw} />
                        ))}
                        {viewMode === 'units' && items.map((unit) => (
                            <ContentUnitCard key={unit.id} unit={unit} showParentInfo />
                        ))}
                        {viewMode === 'topics' && items.map((topic) => (
                            <TopicCard key={topic.id} topic={topic} />
                        ))}
                        {viewMode === 'contents' && items.map((content) => (
                            <ContentCard key={content.id} content={content} />
                        ))}
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}

function ContentCard({ content }: { content: Content }) {
    const analysis = content.aiAnalysis;

    return (
        <Card hover className="bg-slate-900/40 backdrop-blur-md border-slate-800">
            <CardContent className="p-6">
                <div className="flex flex-col gap-4">
                    <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-mono text-slate-500">ID: {content.id}</span>
                            <div className="flex items-center gap-3">
                                <span className={`px-2 py-0.5 text-xs font-bold rounded uppercase tracking-wide ${getStatusColor(content.status)}`}>
                                    {content.status}
                                </span>
                                <span className="text-xs text-slate-400">
                                    {new Date(content.createdAt).toLocaleString()}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50">
                        <p className="text-sm text-slate-300 whitespace-pre-wrap line-clamp-4 hover:line-clamp-none transition-all cursor-pointer">
                            {content.text}
                        </p>
                    </div>

                    {analysis && (
                        <div className="flex flex-wrap gap-2 mt-2">
                            <MetricBadge label="Summary" value={analysis.summary} color="indigo" fullWidth />
                            <div className="flex flex-wrap gap-2 w-full mt-2">
                                <MetricBadge label="Category" value={analysis.category} color="item" />
                                <MetricBadge label="Sentiment" value={analysis.sentiment} color={analysis.sentiment === 'positive' ? 'green' : 'red'} />
                                <MetricBadge label="Lang" value={analysis.language} color="slate" uppercase />
                            </div>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function RawContentCard({ raw, onViewUnits }: { raw: RawContent, onViewUnits: (id: string) => void }) {
    const [showJson, setShowJson] = useState(false);

    return (
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 backdrop-blur-md hover:border-slate-700 transition-all">
            <div className="flex justify-between items-start mb-4">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 text-[10px] font-bold rounded uppercase ${getStatusColor(raw.status)}`}>
                            {raw.status}
                        </span>
                        <span className="text-xs font-mono text-slate-500">ID: {raw.id.substring(0, 8)}...</span>
                    </div>
                </div>
                <div className="text-right space-y-1">
                    <div className="text-xs text-slate-500">External ID: <span className="text-slate-300 font-mono">{raw.externalId}</span></div>
                    <div className="text-xs text-slate-500">Source: <span className="text-slate-300 font-mono">{raw.sourceId}</span></div>
                </div>
            </div>

            <div className="space-y-4">
                <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800/50 text-sm text-slate-300 font-mono whitespace-pre-wrap max-h-60 overflow-y-auto custom-scrollbar">
                    {raw.text}
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {raw.media && Array.isArray(raw.media) && raw.media.length > 0 && (
                        <div className="flex gap-2">
                            {raw.media.map((m: any, i: number) => (
                                <span key={i} className="px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-slate-400">
                                    Media: {m.type || 'Unknown'}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Units display/link */}
                    {raw.contentUnits && raw.contentUnits.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => onViewUnits(raw.id)}
                                className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded text-xs hover:bg-indigo-500/30 transition-colors flex items-center gap-2"
                            >
                                <span>{raw.contentUnits.length} Units Created</span>
                                <span className="text-indigo-400">→</span>
                            </button>
                        </div>
                    ) : (
                        <span className="text-xs text-slate-600">No units generated yet</span>
                    )}
                </div>

                <div>
                    <button
                        onClick={() => setShowJson(!showJson)}
                        className="text-xs text-slate-500 hover:text-slate-300 transition-colors flex items-center gap-1"
                    >
                        {showJson ? 'Hide Source JSON' : 'Show Source JSON'}
                    </button>

                    {showJson && (
                        <div className="mt-2 p-4 rounded-xl bg-slate-950 border border-slate-800 overflow-x-auto">
                            <pre className="text-[10px] font-mono text-slate-500">{JSON.stringify(raw, null, 2)}</pre>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function TopicCard({ topic }: { topic: Topic }) {
    return (
        <Card hover className="bg-slate-900/40 backdrop-blur-md border-slate-800 group">
            <CardContent className="p-6">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-3">
                        <div className="h-10 w-10 flex items-center justify-center rounded-lg bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 text-purple-400 font-bold text-lg">
                            #
                        </div>
                        <div>
                            <h3 className="font-bold text-lg text-white group-hover:text-purple-300 transition-colors">{topic.title || 'Untitled Topic'}</h3>
                            <div className="flex items-center gap-2 text-xs text-slate-500">
                                <span className="bg-slate-800 px-2 py-0.5 rounded border border-slate-700/50">{topic.type}</span>
                                <span>•</span>
                                <span>Score: {topic.relevanceScore}</span>
                            </div>
                        </div>
                    </div>
                    <span className={`px-2 py-1 text-[10px] font-bold rounded border ${(topic as any).active || !(topic as any).isExpired ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-slate-800 text-slate-500 border-slate-700'}`}>
                        {topic.isExpired ? 'EXPIRED' : 'ACTIVE'}
                    </span>
                </div>

                <p className="text-slate-300 text-sm leading-relaxed mb-4">
                    {topic.summary}
                </p>

                <div className="flex justify-between items-center text-xs text-slate-500 border-t border-slate-800/50 pt-4">
                    <div>Category: <span className="text-slate-400">{topic.categoryId}</span></div>
                    <div>Last Updated: {new Date(topic.updatedAt).toLocaleDateString()}</div>
                </div>
            </CardContent>
        </Card>
    );
}

function ContentUnitCard({ unit, showParentInfo }: { unit: ContentUnit; showParentInfo?: boolean }) {
    const [showText, setShowText] = useState(false);
    const [showJson, setShowJson] = useState(false);

    return (
        <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-colors group">
            <div className="flex justify-between items-start mb-3">
                <div className="flex gap-3 items-center">
                    <span className="w-6 h-6 flex items-center justify-center rounded bg-slate-800 text-xs font-mono text-slate-400 border border-slate-700">
                        {unit.unitIndex}
                    </span>
                    <span className="text-sm font-bold text-white capitalize bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        {unit.contentType}
                    </span>
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${unit.qualityScore > 70
                        ? 'bg-green-500/10 text-green-400 border-green-500/20'
                        : 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'}`}>
                        QS: {unit.qualityScore}
                    </span>
                </div>
                <div className="text-[10px] text-slate-600 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                    ID: {unit.id.substring(0, 8)}
                </div>
            </div>

            {showParentInfo && unit.rawContentId && (
                <div className="mb-3 text-xs text-slate-500 flex items-center gap-2">
                    <span className="bg-slate-950 px-2 py-0.5 rounded text-[10px]">Raw Content ID: {unit.rawContentId.substring(0, 8)}...</span>
                </div>
            )}

            <p className="text-sm text-slate-300 leading-relaxed italic mb-4 pl-4 border-l-2 border-slate-800">
                "{unit.summary}"
            </p>

            <div className="flex flex-wrap gap-2 text-xs mb-4">
                {unit.categories?.map((cat: any, i: number) => (
                    <span key={i} className="px-2 py-1 rounded-md bg-slate-800 text-indigo-300 border border-slate-700/50 capitalize">
                        {typeof cat === 'string' ? cat : cat.name}
                    </span>
                ))}
                <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50 capitalize">
                    {unit.sentiment}
                </span>
                <span className="px-2 py-1 rounded-md bg-slate-800 text-slate-400 border border-slate-700/50 uppercase">
                    {unit.language}
                </span>
            </div>

            {unit.qualityReasoning && (
                <div className="text-xs bg-slate-950/50 p-3 rounded-lg border border-slate-800/50 mb-3">
                    <span className="text-slate-500 font-bold uppercase tracking-wider mr-2">Reasoning:</span>
                    <span className="text-slate-400">{unit.qualityReasoning}</span>
                </div>
            )}

            <div className="flex gap-4 border-t border-slate-800/50 pt-3">
                <button
                    onClick={() => setShowText(!showText)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    {showText ? 'Hide Original Text' : 'Show Original Text'}
                </button>
                <button
                    onClick={() => setShowJson(!showJson)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                >
                    {showJson ? 'Hide JSON' : 'Show JSON'}
                </button>
            </div>

            {showText && (
                <div className="mt-2 p-3 rounded bg-slate-950/50 border border-slate-800 text-xs text-slate-400 whitespace-pre-wrap">
                    {unit.originalText || "No original text available."}
                </div>
            )}

            {showJson && (
                <div className="mt-2 p-3 rounded bg-slate-950 border border-slate-800 overflow-x-auto">
                    <pre className="text-[10px] font-mono text-slate-500">{JSON.stringify(unit, null, 2)}</pre>
                </div>
            )}
        </div>
    );
}

function MetricBadge({ label, value, color, uppercase, fullWidth }: { label: string, value: string, color: string, uppercase?: boolean, fullWidth?: boolean }) {
    const colors: any = {
        indigo: 'text-indigo-300 bg-indigo-500/10 border-indigo-500/20',
        green: 'text-green-400 bg-green-500/10 border-green-500/20',
        red: 'text-red-400 bg-red-500/10 border-red-500/20',
        item: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
        slate: 'text-slate-300 bg-slate-700/30 border-slate-600/30',
    };
    const style = colors[color] || colors.slate;

    return (
        <div className={`flex flex-col ${fullWidth ? 'w-full' : ''}`}>
            {label && <span className="text-slate-500 mb-1 text-[10px] uppercase font-bold tracking-wider">{label}</span>}
            <span className={`px-2.5 py-1.5 rounded-md border font-medium ${style} ${uppercase ? 'uppercase' : 'capitalize'} ${fullWidth ? 'w-full' : ''}`}>
                {value || 'N/A'}
            </span>
        </div>
    );
}

function getStatusColor(status: string) {
    if (!status) return 'bg-slate-700 text-slate-300';
    switch (status.toLowerCase()) {
        case 'ready':
        case 'processed':
            return 'bg-green-500/20 text-green-400 shadow-green-900/20';
        case 'error':
        case 'failed':
            return 'bg-red-500/20 text-red-400 shadow-red-900/20';
        case 'parsed': return 'bg-blue-500/20 text-blue-400 shadow-blue-900/20';
        case 'ai_analyzed': return 'bg-purple-500/20 text-purple-400 shadow-purple-900/20';
        case 'vectorizing': return 'bg-amber-500/20 text-amber-400 shadow-amber-900/20';
        default: return 'bg-slate-700 text-slate-300';
    }
}
