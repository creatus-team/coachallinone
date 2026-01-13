'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
    href: string;
    label: string;
    icon: string;
}

const navItems: NavItem[] = [
    { href: '/', label: '홈', icon: '🏠' },
    { href: '/students', label: '수강생', icon: '👥' },
    { href: '/coaches/manage', label: '코치', icon: '🧢' },
    { href: '/slots', label: '슬롯', icon: '⏰' },
    { href: '/coaches', label: '현황', icon: '👀' },
    { href: '/messages', label: '문자', icon: '✉️' },
    { href: '/stats', label: '통계', icon: '📊' },
    { href: '/settlements', label: '정산', icon: '💰' },
];

export default function Sidebar() {
    const pathname = usePathname();

    return (
        <aside className="fixed left-0 top-0 h-full w-56 bg-white border-r border-gray-200 flex flex-col z-50">
            {/* Logo */}
            <div className="p-5 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                        <span className="text-white text-sm font-bold">C</span>
                    </div>
                    <span className="font-bold text-gray-800">크리투스 코칭</span>
                </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3">
                <ul className="space-y-1">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href ||
                            (item.href !== '/' && pathname.startsWith(item.href));

                        return (
                            <li key={item.href}>
                                <Link
                                    href={item.href}
                                    className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                        ? 'bg-emerald-50 text-emerald-600'
                                        : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                        }`}
                                >
                                    <span className="text-base">{item.icon}</span>
                                    {item.label}
                                </Link>
                            </li>
                        );
                    })}
                </ul>
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span className="w-2 h-2 bg-emerald-400 rounded-full"></span>
                    시스템 정상
                </div>
            </div>
        </aside>
    );
}
