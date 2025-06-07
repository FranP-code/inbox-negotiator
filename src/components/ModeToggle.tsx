import * as React from "react";
import { Moon, Sun, Laptop } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const THEME_KEY = "theme";

type Theme = "light" | "dark" | "system";

function getSystemTheme(): Theme {
	if (typeof window !== "undefined" && window.matchMedia) {
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	}
	return "light";
}

function getStoredTheme(): Theme | null {
	if (typeof localStorage !== "undefined") {
		const t = localStorage.getItem(THEME_KEY);
		if (t === "light" || t === "dark" || t === "system") return t;
	}
	return null;
}

function setStoredTheme(theme: Theme | null) {
	if (typeof localStorage !== "undefined") {
		if (theme) {
			localStorage.setItem(THEME_KEY, theme);
		} else {
			localStorage.removeItem(THEME_KEY);
		}
	}
}

function applyTheme(theme: Theme) {
	const root = document.documentElement;
	if (theme === "system") {
		root.classList.toggle("dark", getSystemTheme() === "dark");
	} else {
		root.classList.toggle("dark", theme === "dark");
	}
}

export function ModeToggle() {
	const [theme, setTheme] = React.useState<Theme>(
		() => getStoredTheme() || "system"
	);

	React.useEffect(() => {
		const stored = getStoredTheme();
		if (stored) setTheme(stored);
	}, []);

	React.useEffect(() => {
		setStoredTheme(theme === "system" ? null : theme);
		applyTheme(theme);
	}, [theme]);

	React.useEffect(() => {
		if (theme === "system") {
			const mq = window.matchMedia("(prefers-color-scheme: dark)");
			const handler = () => applyTheme("system");
			mq.addEventListener("change", handler);
			return () => mq.removeEventListener("change", handler);
		}
	}, [theme]);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="icon">
					<Sun className="h-[1.2rem] w-[1.2rem] scale-100 rotate-0 transition-all dark:scale-0 dark:-rotate-90" />
					<Moon className="absolute h-[1.2rem] w-[1.2rem] scale-0 rotate-90 transition-all dark:scale-100 dark:rotate-0" />
					<span className="sr-only">Toggle theme</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuItem onClick={() => setTheme("light")}>
					Light
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("dark")}>
					Dark
				</DropdownMenuItem>
				<DropdownMenuItem onClick={() => setTheme("system")}>
					System
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
