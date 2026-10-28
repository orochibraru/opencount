import ArrowLeftRightIcon from "@lucide/svelte/icons/arrow-left-right";
import BabyIcon from "@lucide/svelte/icons/baby";
import BedIcon from "@lucide/svelte/icons/bed-double";
import BeerIcon from "@lucide/svelte/icons/beer";
import BookOpenIcon from "@lucide/svelte/icons/book-open";
import BriefcaseIcon from "@lucide/svelte/icons/briefcase";
import CarIcon from "@lucide/svelte/icons/car";
import CoffeeIcon from "@lucide/svelte/icons/coffee";
import DumbbellIcon from "@lucide/svelte/icons/dumbbell";
import Gamepad2Icon from "@lucide/svelte/icons/gamepad-2";
import GiftIcon from "@lucide/svelte/icons/gift";
import GraduationCapIcon from "@lucide/svelte/icons/graduation-cap";
import HandCoinsIcon from "@lucide/svelte/icons/hand-coins";
import HeartIcon from "@lucide/svelte/icons/heart";
import HouseIcon from "@lucide/svelte/icons/house";
import LandmarkIcon from "@lucide/svelte/icons/landmark";
import MusicIcon from "@lucide/svelte/icons/music";
import PawPrintIcon from "@lucide/svelte/icons/paw-print";
import PiggyBankIcon from "@lucide/svelte/icons/piggy-bank";
import PillIcon from "@lucide/svelte/icons/pill";
import PlaneIcon from "@lucide/svelte/icons/plane";
import ReceiptIcon from "@lucide/svelte/icons/receipt";
import ScissorsIcon from "@lucide/svelte/icons/scissors";
import ShirtIcon from "@lucide/svelte/icons/shirt";
import ShoppingBagIcon from "@lucide/svelte/icons/shopping-bag";
import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
import TagIcon from "@lucide/svelte/icons/tag";
import TicketIcon from "@lucide/svelte/icons/ticket";
import TvIcon from "@lucide/svelte/icons/tv";
import UtensilsIcon from "@lucide/svelte/icons/utensils";
import WrenchIcon from "@lucide/svelte/icons/wrench";
import ZapIcon from "@lucide/svelte/icons/zap";
import type { Component } from "svelte";

import { categoryLabels } from "#lib/category-labels.js";
import { hueOf } from "#lib/group-hue.js";

export interface CategoryOption {
	value: string;
	label: string;
	icon: Component<{ class?: string }>;
	hue: number | null;
}

/** A category a group added on top of the built-in ones. */
export interface CustomCategory {
	id: string;
	name: string;
	icon: string;
}

const other = {
	value: "other",
	label: categoryLabels.other,
	icon: ReceiptIcon,
	hue: null,
} as const;

export const categories = [
	{ value: "food", label: categoryLabels.food, icon: UtensilsIcon, hue: 40 },
	{
		value: "groceries",
		label: categoryLabels.groceries,
		icon: ShoppingCartIcon,
		hue: 140,
	},
	{
		value: "transport",
		label: categoryLabels.transport,
		icon: CarIcon,
		hue: 240,
	},
	{ value: "lodging", label: categoryLabels.lodging, icon: BedIcon, hue: 285 },
	{ value: "travel", label: categoryLabels.travel, icon: PlaneIcon, hue: 190 },
	{
		value: "activities",
		label: categoryLabels.activities,
		icon: TicketIcon,
		hue: 325,
	},
	{
		value: "shopping",
		label: categoryLabels.shopping,
		icon: ShoppingBagIcon,
		hue: 75,
	},
	{ value: "bills", label: categoryLabels.bills, icon: ZapIcon, hue: 205 },
	{ value: "home", label: categoryLabels.home, icon: HouseIcon, hue: 105 },
	{ value: "health", label: categoryLabels.health, icon: PillIcon, hue: 175 },
	{ value: "pets", label: categoryLabels.pets, icon: PawPrintIcon, hue: 5 },
	{
		value: "subscriptions",
		label: categoryLabels.subscriptions,
		icon: TvIcon,
		hue: 265,
	},
	{ value: "care", label: categoryLabels.care, icon: ScissorsIcon, hue: 345 },
	{
		value: "education",
		label: categoryLabels.education,
		icon: GraduationCapIcon,
		hue: 55,
	},
	{
		value: "culture",
		label: categoryLabels.culture,
		icon: MusicIcon,
		hue: 158,
	},
	{
		value: "family",
		label: categoryLabels.family,
		icon: HeartIcon,
		hue: 90,
	},
	{
		value: "finance",
		label: categoryLabels.finance,
		icon: PiggyBankIcon,
		hue: 305,
	},
	{
		value: "taxes",
		label: categoryLabels.taxes,
		icon: LandmarkIcon,
		hue: 20,
	},
	{
		value: "income",
		label: categoryLabels.income,
		icon: HandCoinsIcon,
		hue: 225,
	},
	{
		value: "internal",
		label: categoryLabels.internal,
		icon: ArrowLeftRightIcon,
		hue: null,
	},
	other,
] as const satisfies readonly CategoryOption[];

export type Category = (typeof categories)[number]["value"];

/** The icons a custom category can pick from, by the key stored with it. */
export const customCategoryIcons: Record<
	string,
	Component<{ class?: string }>
> = {
	tag: TagIcon,
	house: HouseIcon,
	heart: HeartIcon,
	gift: GiftIcon,
	baby: BabyIcon,
	pet: PawPrintIcon,
	plane: PlaneIcon,
	clothes: ShirtIcon,
	sport: DumbbellIcon,
	games: Gamepad2Icon,
	music: MusicIcon,
	books: BookOpenIcon,
	work: BriefcaseIcon,
	repairs: WrenchIcon,
	health: PillIcon,
	coffee: CoffeeIcon,
	drinks: BeerIcon,
};

function customOption(category: CustomCategory): CategoryOption {
	return {
		value: category.id,
		label: category.name,
		icon: customCategoryIcons[category.icon] ?? TagIcon,
		hue: hueOf(category.id),
	};
}

/** The inline style that gives a `category-tile` its category's colour, grey for Other. */
export function categoryStyle(option: Pick<CategoryOption, "hue">): string {
	return option.hue === null
		? "--category-chroma: 0"
		: `--category-hue: ${option.hue}`;
}

/** Every category a group can file an expense under: the built-in ones, then its own. */
export function categoryOptions(custom: CustomCategory[]): CategoryOption[] {
	return [...categories, ...custom.map(customOption)];
}

/** The label and icon of `category`, a built-in key or one of `custom`'s ids, falling back to Other. */
export function categoryOf(
	category: string,
	custom: CustomCategory[] = [],
): CategoryOption {
	const builtIn = categories.find((entry) => entry.value === category);
	if (builtIn) {
		return builtIn;
	}
	const own = custom.find((entry) => entry.id === category);
	return own ? customOption(own) : other;
}
