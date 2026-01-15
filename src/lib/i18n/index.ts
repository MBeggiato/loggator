import { writable, derived, get } from 'svelte/store';
import en from './translations/en';
import de from './translations/de';

export type Locale = 'en' | 'de';

// Define a more flexible type that accepts any string values
export type Translations = {
	[K in keyof typeof en]: {
		[P in keyof (typeof en)[K]]: string;
	};
};

const translations: Record<Locale, Translations> = { en, de };

// Initialize from localStorage if available, default to 'en'
function getInitialLocale(): Locale {
	if (typeof window !== 'undefined') {
		const stored = localStorage.getItem('loggator-locale');
		if (stored === 'en' || stored === 'de') {
			return stored;
		}
	}
	return 'en';
}

// Create the locale store
export const locale = writable<Locale>(getInitialLocale());

// Persist locale changes to localStorage
if (typeof window !== 'undefined') {
	locale.subscribe((value) => {
		localStorage.setItem('loggator-locale', value);
	});
}

// Derived store for current translations
export const t = derived(locale, ($locale) => translations[$locale]);

// Helper function to get current translations (for non-reactive contexts)
export function getTranslations(): Translations {
	return translations[get(locale)];
}

// Helper to format numbers based on locale
export function formatNumber(num: number): string {
	const currentLocale = get(locale);
	return num.toLocaleString(currentLocale === 'de' ? 'de-DE' : 'en-US');
}

// Helper to format dates based on locale
export function formatDate(date: Date | number, options?: Intl.DateTimeFormatOptions): string {
	const currentLocale = get(locale);
	const d = typeof date === 'number' ? new Date(date) : date;
	return d.toLocaleString(currentLocale === 'de' ? 'de-DE' : 'en-US', options);
}

// Available locales for UI
export const availableLocales: { code: Locale; name: string; flag: string }[] = [
	{ code: 'en', name: 'English', flag: '🇬🇧' },
	{ code: 'de', name: 'Deutsch', flag: '🇩🇪' }
];
