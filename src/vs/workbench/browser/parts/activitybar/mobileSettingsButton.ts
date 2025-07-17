/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { addDisposableListener, append, EventType, $, getActiveWindow } from '../../../../base/browser/dom.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';

export interface IMobileSettingsItem {
	id: string;
	label: string;
	iconClass: string;
	command: string;
}

export class MobileSettingsButton extends Disposable {
	private container: HTMLElement | undefined;
	private menuOverlay: HTMLElement | undefined;
	private menuVisible = false;
	private submenuButton: HTMLElement | undefined;
	private currentActiveView: IMobileSettingsItem | undefined;
	private defaultIcon = 'codicon-settings-gear';
	private defaultTitle = 'Settings Menu';

	constructor(
		private readonly commandService: ICommandService
	) {
		super();
	}

	create(parent: HTMLElement): HTMLElement {
		const targetWindow = getActiveWindow();
		this.container = append(parent, $('.mobile-settings-container'));

		// Create submenu button with settings icon
		this.submenuButton = append(this.container, $('.settings-button'));
		this.submenuButton.className = `settings-button codicon ${this.defaultIcon}`;
		this.submenuButton.setAttribute('title', this.defaultTitle);

		// Monitor sidebar state to reset button when sidebar closes
		this.monitorSidebarState();

		// Add click handler for submenu button
		this._register(addDisposableListener(this.submenuButton, EventType.CLICK, async (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('Mobile settings button clicked, current state:', this.menuVisible);

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
		this.menuOverlay = append(targetWindow.document.body, $('.mobile-settings-overlay'));
		this.menuOverlay.style.display = 'none';

		// Create menu content
		const menuContent = append(this.menuOverlay, $('.mobile-settings-content'));

		// Menu items for Extensions, Settings, and Accounts
		const menuItems: IMobileSettingsItem[] = [
			{
				id: 'extensions',
				label: 'Extensions',
				iconClass: 'codicon-extensions',
				command: 'workbench.view.extensions'
			},
			{
				id: 'settings',
				label: 'Settings',
				iconClass: 'codicon-settings-gear',
				command: 'workbench.action.openSettings'
			},
			{
				id: 'accounts',
				label: 'Accounts',
				iconClass: 'codicon-account',
				command: 'workbench.view.accounts'
			}
		];

		// Create menu items with animation delay
		menuItems.forEach((item, index) => {
			const menuItem = append(menuContent, $('.mobile-settings-item'));
			menuItem.setAttribute('data-command', item.command);
			menuItem.style.setProperty('--animation-delay', `${index * 100}ms`);

			const icon = append(menuItem, $('.mobile-settings-icon'));
			icon.className = `mobile-settings-icon codicon ${item.iconClass}`;

			const label = append(menuItem, $('.mobile-settings-label'));
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

		console.log('Settings menu should be visible now');
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
		console.log('Settings menu hidden');
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
				console.log('Sidebar closed, resetting settings button to default state');
				this.currentActiveView = undefined;
				if (this.submenuButton) {
					this.submenuButton.className = `settings-button codicon ${this.defaultIcon}`;
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

	private setActiveView(item: IMobileSettingsItem): void {
		this.currentActiveView = item;
		if (this.submenuButton) {
			// Update the button icon and title to reflect the active view
			this.submenuButton.className = `settings-button codicon ${item.iconClass}`;
			this.submenuButton.setAttribute('title', `${item.label} (tap to return to editor)`);
		}
		console.log(`Set active settings view to: ${item.label}`);
	}

	private async returnToEditor(): Promise<void> {
		// Reset to default state
		this.currentActiveView = undefined;
		if (this.submenuButton) {
			this.submenuButton.className = `settings-button codicon ${this.defaultIcon}`;
			this.submenuButton.setAttribute('title', this.defaultTitle);
		}

		try {
			// Close sidebar and focus on editor
			await this.commandService.executeCommand('workbench.action.closeSidebar');
			await this.commandService.executeCommand('workbench.action.focusActiveEditorGroup');
			console.log('Returned to editor from settings');
		} catch (error) {
			console.error('Failed to return to editor from settings:', error);
		}
	}

	isMenuVisible(): boolean {
		return this.menuVisible;
	}

	override dispose(): void {
		// Clean up menu overlay from document.body
		if (this.menuOverlay && this.menuOverlay.parentNode) {
			this.menuOverlay.parentNode.removeChild(this.menuOverlay);
		}
		super.dispose();
	}
}
