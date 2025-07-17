/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { addDisposableListener, append, EventType, $, getActiveWindow } from '../../../../base/browser/dom.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

export interface IMobileMenuItem {
	id: string;
	label: string;
	iconClass: string;
	command: string;
}

export class MobileMenuButton extends Disposable {
	private container: HTMLElement | undefined;
	private menuOverlay: HTMLElement | undefined;
	private menuVisible = false;
	private mutationObserver: MutationObserver | undefined;
	private submenuButton: HTMLElement | undefined;
	private currentActiveView: IMobileMenuItem | undefined;
	private defaultIcon = 'codicon-files';
	private defaultTitle = 'Navigation Menu';

	constructor(
		private readonly commandService: ICommandService
	) {
		super();
	}

	create(parent: HTMLElement): HTMLElement {
		const targetWindow = getActiveWindow();
		this.container = append(parent, $('.mobile-menu-container'));

		// Create submenu button with files icon (same as file explorer)
		this.submenuButton = append(this.container, $('.submenu-button'));
		this.submenuButton.className = `submenu-button codicon ${this.defaultIcon}`;
		this.submenuButton.setAttribute('title', this.defaultTitle);

		// Hide explorer, search, and scm icons from activity bar on mobile
		this.hideActivityBarIcons();

		// Monitor sidebar state to reset button when sidebar closes
		this.monitorSidebarState();

		// Add click handler for submenu button
		this._register(addDisposableListener(this.submenuButton, EventType.CLICK, async (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('Mobile menu button clicked, current state:', this.menuVisible);

			// If there's an active view, toggle it off and return to editor
			if (this.currentActiveView) {
				await this.returnToEditor();
			} else {
				// No active view, show the menu
				if (this.menuVisible) {
					this.hideMenu();
				} else {
					this.showMenu();
				}
			}
		}));

		// Create menu overlay directly in target window's document.body for full screen coverage
		this.menuOverlay = append(targetWindow.document.body, $('.mobile-menu-overlay'));
		this.menuOverlay.style.display = 'none';

		// Create menu content
		const menuContent = append(this.menuOverlay, $('.mobile-menu-content'));

		// Menu items for Explorer, Search, Source Control
		const menuItems: IMobileMenuItem[] = [
			{
				id: 'explorer',
				label: 'Explorer',
				iconClass: 'codicon-files',
				command: 'workbench.view.explorer'
			},
			{
				id: 'search',
				label: 'Search',
				iconClass: 'codicon-search',
				command: 'workbench.view.search'
			},
			{
				id: 'scm',
				label: 'Source Control',
				iconClass: 'codicon-source-control',
				command: 'workbench.view.scm'
			}
		];

		// Create menu items with animation delay
		menuItems.forEach((item, index) => {
			const menuItem = append(menuContent, $('.mobile-menu-item'));
			menuItem.setAttribute('data-command', item.command);
			menuItem.style.setProperty('--animation-delay', `${index * 100}ms`);

			const icon = append(menuItem, $('.mobile-menu-icon'));
			icon.className = `mobile-menu-icon codicon ${item.iconClass}`;

			const label = append(menuItem, $('.mobile-menu-label'));
			label.textContent = item.label;

			// Add click handler
			this._register(addDisposableListener(menuItem, EventType.CLICK, async (e) => {
				e.preventDefault();
				e.stopPropagation();
				console.log(`Executing command: ${item.command} for ${item.label}`);

				try {
					// Execute the command to open the view
					await this.commandService.executeCommand(item.command);
					console.log(`Successfully opened ${item.label}`);

					// Update the menu button to reflect the active view
					this.setActiveView(item);
				} catch (error) {
					console.error(`Failed to open ${item.label}:`, error);
				}

				this.hideMenu();
			}));
		});

		// Close menu when clicking overlay background
		this._register(addDisposableListener(this.menuOverlay, EventType.CLICK, (e) => {
			if (e.target === this.menuOverlay) {
				this.hideMenu();
			}
		}));

		// Close menu on ESC key
		this._register(addDisposableListener(targetWindow.document, EventType.KEY_DOWN, (e) => {
			if (this.menuVisible && e.key === 'Escape') {
				this.hideMenu();
			}
		}));

		return this.container;
	}

	showMenu(): void {
		console.log('showMenu called, menuOverlay:', this.menuOverlay);
		if (!this.menuOverlay) {
			console.log('No menuOverlay found!');
			return;
		}

		// Show overlay immediately for debugging
		this.menuOverlay.style.display = 'flex';
		this.menuOverlay.classList.add('show');
		this.menuVisible = true;

		console.log('Menu should be visible now');
		console.log('Overlay display:', this.menuOverlay.style.display);
		console.log('Overlay classes:', this.menuOverlay.className);
	}

	hideMenu(): void {
		if (!this.menuOverlay) {
			return;
		}

		this.menuOverlay.style.display = 'none';
		this.menuOverlay.classList.remove('show');
		this.menuVisible = false;
		console.log('Menu hidden');
	}

	private hideActivityBarIcons(): void {
		const targetWindow = getActiveWindow();

		// Check if we're on mobile
		const isMobile = () => targetWindow.innerWidth <= 768;

		if (!isMobile()) {
			return;
		}

		const hideIcons = () => {
			const activityBarElement = targetWindow.document.querySelector('.part.activitybar');
			if (!activityBarElement) {
				return;
			}

			// Multiple approaches to find and hide the icons
			const selectors = [
				'.composite-bar .action-item',
				'.composite-bar .monaco-action-bar .action-item',
				'.composite-bar > .monaco-action-bar > .actions-container > .action-item',
				'.global-composite-bar .action-item',
				'.global-composite-bar .monaco-action-bar .action-item',
				'[aria-label*="Explorer"]',
				'[aria-label*="Search"]',
				'[aria-label*="Source Control"]',
				'[aria-label*="Extensions"]',
				'[aria-label*="Manage Extensions"]',
				'[aria-label*="Run and Debug"]',
				'[aria-label*="Debug"]',
				'[title*="Explorer"]',
				'[title*="Search"]',
				'[title*="Source Control"]',
				'[title*="Extensions"]',
				'[title*="Manage Extensions"]',
				'[title*="Run and Debug"]',
				'[title*="Debug"]',
				'[data-id="workbench.view.explorer"]',
				'[data-id="workbench.view.search"]',
				'[data-id="workbench.view.scm"]',
				'[data-id="workbench.view.extensions"]',
				'[data-id="workbench.view.debug"]',
				'.codicon-extensions',
				'.codicon-debug-alt',
				'[class*="extensions"]',
				'[class*="debug"]'
			];

			selectors.forEach(selector => {
				const elements = activityBarElement.querySelectorAll(selector);
				console.log(`Selector "${selector}" found ${elements.length} elements`);
				elements.forEach((element: Element, index: number) => {
					const htmlElement = element as HTMLElement;
					console.log(`Element ${index}:`, htmlElement.outerHTML.substring(0, 200));

					// For general selectors, only hide first 5 (Explorer, Search, Source Control, Extensions, Debug)
					if (selector === '.composite-bar .action-item' ||
						selector === '.composite-bar .monaco-action-bar .action-item' ||
						selector === '.composite-bar > .monaco-action-bar > .actions-container > .action-item') {
						if (index >= 5) {
							console.log(`Skipping element ${index} for general selector`);
							return;
						}
					}

					// For global composite bar, hide all matched items
					// Apply multiple hiding strategies
					htmlElement.style.setProperty('display', 'none', 'important');
					htmlElement.style.setProperty('visibility', 'hidden', 'important');
					htmlElement.style.setProperty('opacity', '0', 'important');
					htmlElement.style.setProperty('width', '0', 'important');
					htmlElement.style.setProperty('height', '0', 'important');
					htmlElement.style.setProperty('margin', '0', 'important');
					htmlElement.style.setProperty('padding', '0', 'important');
					htmlElement.style.setProperty('overflow', 'hidden', 'important');
					htmlElement.style.setProperty('position', 'absolute', 'important');
					htmlElement.style.setProperty('left', '-9999px', 'important');
					htmlElement.style.setProperty('top', '-9999px', 'important');
					htmlElement.style.setProperty('pointer-events', 'none', 'important');

					// Also add a class to mark it as hidden
					htmlElement.classList.add('mobile-hidden-icon');

					// Remove from tab order
					htmlElement.setAttribute('tabindex', '-1');
					htmlElement.setAttribute('aria-hidden', 'true');
					console.log(`Hidden element with selector "${selector}"`);
				});
			});

			console.log('Hidden activity bar icons for mobile');
		};

		// Initial hide
		setTimeout(hideIcons, 100);

		// Set up MutationObserver to hide icons that might be added dynamically
		const activityBarElement = targetWindow.document.querySelector('.part.activitybar');
		if (activityBarElement) {
			this.mutationObserver = new MutationObserver(() => {
				hideIcons();
			});

			this.mutationObserver.observe(activityBarElement, {
				childList: true,
				subtree: true,
				attributes: true,
				attributeFilter: ['class', 'style']
			});
		}
	}

	private monitorSidebarState(): void {
		const targetWindow = getActiveWindow();
		const isMobile = () => targetWindow.innerWidth <= 768;

		if (!isMobile()) {
			return;
		}

		// Find the sidebar element
		const sidebar = targetWindow.document.querySelector('.part.sidebar');
		if (!sidebar) {
			return;
		}

		// Create a MutationObserver to watch for style changes
		const sidebarObserver = new MutationObserver(() => {
			const computedStyle = targetWindow.getComputedStyle(sidebar);
			const transform = computedStyle.transform;

			// Check if sidebar is hidden (translateX(-100%) or similar)
			const isHidden = transform.includes('translateX(-100%') ||
				transform.includes('translateX(-') ||
				(transform === 'none' && computedStyle.left === '-100%');

			// If sidebar is hidden and we have an active view, reset to default
			if (isHidden && this.currentActiveView) {
				console.log('Sidebar closed, resetting to default state');
				this.currentActiveView = undefined;
				if (this.submenuButton) {
					this.submenuButton.className = `submenu-button codicon ${this.defaultIcon}`;
					this.submenuButton.setAttribute('title', this.defaultTitle);
				}
			}
		});

		// Observe style changes on the sidebar
		sidebarObserver.observe(sidebar, {
			attributes: true,
			attributeFilter: ['style', 'class']
		});

		// Store the observer for cleanup
		this._register({
			dispose: () => {
				sidebarObserver.disconnect();
			}
		});
	}

	private setActiveView(item: IMobileMenuItem): void {
		this.currentActiveView = item;
		if (this.submenuButton) {
			// Update the button icon and title to reflect the active view
			this.submenuButton.className = `submenu-button codicon ${item.iconClass}`;
			this.submenuButton.setAttribute('title', `${item.label} (tap to return to editor)`);
		}
		console.log(`Set active view to: ${item.label}`);
	}

	private async returnToEditor(): Promise<void> {
		// Reset to default state
		this.currentActiveView = undefined;
		if (this.submenuButton) {
			this.submenuButton.className = `submenu-button codicon ${this.defaultIcon}`;
			this.submenuButton.setAttribute('title', this.defaultTitle);
		}

		try {
			// Close sidebar and focus on editor
			await this.commandService.executeCommand('workbench.action.closeSidebar');
			await this.commandService.executeCommand('workbench.action.focusActiveEditorGroup');
			console.log('Returned to editor');
		} catch (error) {
			console.error('Failed to return to editor:', error);
		}
	}

	isMenuVisible(): boolean {
		return this.menuVisible;
	}

	override dispose(): void {
		// Clean up MutationObserver
		if (this.mutationObserver) {
			this.mutationObserver.disconnect();
			this.mutationObserver = undefined;
		}

		// Clean up menu overlay from document.body
		if (this.menuOverlay && this.menuOverlay.parentNode) {
			this.menuOverlay.parentNode.removeChild(this.menuOverlay);
		}
		super.dispose();
	}
}
