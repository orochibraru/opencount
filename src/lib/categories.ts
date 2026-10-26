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
import HeartIcon from "@lucide/svelte/icons/heart";
import HouseIcon from "@lucide/svelte/icons/house";
import MusicIcon from "@lucide/svelte/icons/music";
import PawPrintIcon from "@lucide/svelte/icons/paw-print";
import PillIcon from "@lucide/svelte/icons/pill";
import PlaneIcon from "@lucide/svelte/icons/plane";
import ReceiptIcon from "@lucide/svelte/icons/receipt";
import ShirtIcon from "@lucide/svelte/icons/shirt";
import ShoppingBagIcon from "@lucide/svelte/icons/shopping-bag";
import ShoppingCartIcon from "@lucide/svelte/icons/shopping-cart";
import TagIcon from "@lucide/svelte/icons/tag";
import TicketIcon from "@lucide/svelte/icons/ticket";
import UtensilsIcon from "@lucide/svelte/icons/utensils";
import WrenchIcon from "@lucide/svelte/icons/wrench";
import ZapIcon from "@lucide/svelte/icons/zap";
import type { Component } from "svelte";

export interface CategoryOption {
	value: string;
	label: string;
	icon: Component<{ class?: string }>;
}

/** A category a group added on top of the built-in ones. */
export interface CustomCategory {
	id: string;
	name: string;
	icon: string;
}

const other = { value: "other", label: "Other", icon: ReceiptIcon } as const;

export const categories = [
	{ value: "food", label: "Food & drinks", icon: UtensilsIcon },
	{ value: "groceries", label: "Groceries", icon: ShoppingCartIcon },
	{ value: "transport", label: "Transport", icon: CarIcon },
	{ value: "lodging", label: "Lodging", icon: BedIcon },
	{ value: "activities", label: "Activities", icon: TicketIcon },
	{ value: "shopping", label: "Shopping", icon: ShoppingBagIcon },
	{ value: "bills", label: "Bills", icon: ZapIcon },
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
	};
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
