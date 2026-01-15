'use client';

import { useState } from 'react';

interface StudentMemoProps {
    userId: string;
    initialMemo: string;
}

export default function StudentMemo({ userId, initialMemo }: StudentMemoProps) {
    const [memo, setMemo] = useState(initialMemo);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/students/${userId}/memos`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: memo })
            });
            const data = await res.json();
            if (data.success) {
                setSaved(true);
                setTimeout(() => setSaved(false), 2000);
            }
        } catch (e) {
            console.error('Memo save error:', e);
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl border border-gray-200 mt-6 p-6">
            <div className="flex justify-between items-center mb-4">
                <h2 className="font-semibold text-gray-800">📌 특이사항 메모</h2>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${saved
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                >
                    {saving ? '저장 중...' : saved ? '✅ 저장됨' : '저장'}
                </button>
            </div>
            <textarea
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                placeholder="이 수강생에 대한 특이사항이나 메모를 입력하세요..."
                className="w-full h-32 p-3 border border-gray-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
        </div>
    );
}
