/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { addDisposableListener, append, EventType, $, getActiveWindow } from '../../../../base/browser/dom.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { Extensions as ViewExtensions, IViewContainersRegistry } from '../../../common/views.js';

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
	private removedContainers: Array<{ id: string; container: any; location: any }> = [];

	constructor(
		private readonly commandService: ICommandService
	) {
		super();
		this.handleViewContainersForMobile();
	}

	private handleViewContainersForMobile(): void {
		const targetWindow = getActiveWindow();

		// Check if we're on mobile by window width
		const isMobile = () => targetWindow.innerWidth <= 768;

		const removeContainersOnMobile = () => {
			if (isMobile()) {
				this.removeViewContainers();
			} else {
				this.restoreViewContainers();
			}
		};

		// Initial check
		removeContainersOnMobile();

		// Listen for window resize to handle mobile/desktop switching
		targetWindow.addEventListener('resize', removeContainersOnMobile);

		// Store the listener for cleanup
		this._register({
			dispose: () => {
				targetWindow.removeEventListener('resize', removeContainersOnMobile);
				this.restoreViewContainers(); // Restore when disposing
			}
		});
	}

	private removeViewContainers(): void {
		if (this.removedContainers.length > 0) {
			return; // Already removed
		}

		const registry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		const containerIds = [
			'workbench.view.explorer',
			'workbench.view.search',
			'workbench.view.scm'
		];

		containerIds.forEach(id => {
			const container = registry.get(id);
			if (container) {
				const location = registry.getViewContainerLocation(container);
				this.removedContainers.push({ id, container, location });
				registry.deregisterViewContainer(container);
			}
		});
	}

	private restoreViewContainers(): void {
		if (this.removedContainers.length === 0) {
			return; // Nothing to restore
		}

		const registry = Registry.as<IViewContainersRegistry>(ViewExtensions.ViewContainersRegistry);

		this.removedContainers.forEach(({ container, location }) => {
			try {
				registry.registerViewContainer(container, location);
			} catch (error) {
				// Container might already be registered, ignore error
				console.debug('Container already registered:', container.id);
			}
		});

		this.removedContainers = [];
	}

	create(parent: HTMLElement): HTMLElement {
		const targetWindow = getActiveWindow();
		this.container = append(parent, $('.mobile-menu-container'));

		// Create submenu button with files icon (same as file explorer)
		const submenuButton = append(this.container, $('.submenu-button'));
		submenuButton.className = 'submenu-button codicon codicon-files';
		submenuButton.setAttribute('title', 'File Explorer');

		// Add click handler for submenu button
		this._register(addDisposableListener(submenuButton, EventType.CLICK, (e) => {
			e.preventDefault();
			e.stopPropagation();
			console.log('Mobile menu button clicked, current state:', this.menuVisible);
			if (this.menuVisible) {
				this.hideMenu();
			} else {
				this.showMenu();
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
			this._register(addDisposableListener(menuItem, EventType.CLICK, (e) => {
				e.preventDefault();
				e.stopPropagation();
				this.executeCommand(item.command);
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

	private async executeCommand(command: string): Promise<void> {
		try {
			await this.commandService.executeCommand(command);
		} catch (error) {
			console.error('Failed to execute command:', command, error);
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
