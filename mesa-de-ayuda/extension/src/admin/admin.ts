import { authService } from '../sidepanel/services/auth-service';
import { adminApiClient, SharedTemplate, UserUsageMetric } from './admin-api-client';

export function escapeHtml(str: unknown): string {
  if (str === null || str === undefined) return '';
  const s = String(str);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showAdminToast(message: string, type: 'success' | 'error' | 'info' = 'info'): void {
  const container = document.getElementById('admin-toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `admin-toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

function openModal(modalId: string): void {
  const modal = document.getElementById(modalId);
  modal?.classList.add('active');
}

function closeModal(modalId: string): void {
  const modal = document.getElementById(modalId);
  modal?.classList.remove('active');
}

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inicializar autenticación y validar rol ADMIN
  await authService.init();

  const user = authService.getUser();
  if (!authService.isAuthenticated() || !user || user.role !== 'ADMIN') {
    document.body.innerHTML = `
      <div style="max-width: 480px; margin: 100px auto; text-align: center; font-family: sans-serif; padding: 32px; background: white; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <div style="font-size: 3rem; margin-bottom: 12px;">🚫</div>
        <h2 style="color: #0f172a; margin-bottom: 8px;">Acceso Restringido (403)</h2>
        <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 24px;">No tienes permisos para acceder al Panel de Administración. Esta sección está reservada exclusivamente para administradores.</p>
        <button id="btn-unauthorized-back" style="background: #7c3aed; color: white; border: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; cursor: pointer;">Cerrar esta pestaña</button>
      </div>
    `;
    document.getElementById('btn-unauthorized-back')?.addEventListener('click', () => window.close());
    return;
  }

  // Configurar header
  const adminNameEl = document.getElementById('admin-display-name');
  if (adminNameEl) adminNameEl.textContent = user.displayName;

  // Botón Volver al Asistente
  document.getElementById('btn-back-to-assistant')?.addEventListener('click', () => {
    window.close();
  });

  // Botón Logout
  document.getElementById('btn-admin-logout')?.addEventListener('click', async () => {
    await authService.logout();
    window.location.reload();
  });

  // Configurar cierre de modales
  document.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const modal = btn.closest('.modal-backdrop');
      if (modal) modal.classList.remove('active');
    });
  });

  // 2. Manejo de Navegación de Vistas
  const navButtons = document.querySelectorAll<HTMLButtonElement>('.sidebar-nav .nav-item');
  const viewSections = document.querySelectorAll<HTMLElement>('.view-section');
  const pageTitleEl = document.getElementById('page-title');

  const viewTitles: Record<string, string> = {
    resumen: 'Resumen General',
    usuarios: 'Gestión de Usuarios',
    consumo: 'Consumo de IA y Límites',
    biblioteca: 'Biblioteca Compartida',
    actividad: 'Actividad y Auditoría',
    seguridad: 'Seguridad y Sesiones',
    sistema: 'Estado y Monitoreo del Sistema',
  };

  async function switchView(viewName: string) {
    navButtons.forEach((btn) => btn.classList.toggle('active', btn.dataset.view === viewName));
    viewSections.forEach((sec) => sec.classList.toggle('active', sec.id === `view-${viewName}`));
    if (pageTitleEl) pageTitleEl.textContent = viewTitles[viewName] || 'Administración';

    switch (viewName) {
      case 'resumen':
        await loadSummary();
        break;
      case 'usuarios':
        await loadUsers();
        break;
      case 'consumo':
        await loadUsage();
        break;
      case 'biblioteca':
        await loadSharedLibrary();
        break;
      case 'actividad':
        await loadAuditLogs();
        break;
      case 'seguridad':
        await loadSecurity();
        break;
      case 'sistema':
        await loadSystemHealth();
        break;
    }
  }

  navButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view;
      if (view) switchView(view);
    });
  });

  // 3. VISTA RESUMEN
  async function loadSummary() {
    const res = await adminApiClient.getSummary();
    if (res.success && res.data) {
      const d = res.data;
      const elTotal = document.getElementById('kpi-users-total');
      const elSub = document.getElementById('kpi-users-sub');
      const elToday = document.getElementById('kpi-requests-today');
      const elMonth = document.getElementById('kpi-requests-month');
      const elTokens = document.getElementById('kpi-tokens-month');
      const elCost = document.getElementById('kpi-cost-month');
      const elShared = document.getElementById('kpi-shared-templates');

      if (elTotal) elTotal.textContent = String(d.users.total);
      if (elSub) elSub.textContent = `${d.users.active} activos / ${d.users.inactive} inactivos`;
      if (elToday) elToday.textContent = d.usage.requestsToday.toLocaleString();
      if (elMonth) elMonth.textContent = d.usage.requestsMonth.toLocaleString();
      if (elTokens) elTokens.textContent = d.usage.totalTokensMonth.toLocaleString();
      if (elCost) elCost.textContent = `Costo estimado: $${d.usage.estimatedCostUsd.toFixed(4)} USD`;
      if (elShared) elShared.textContent = String(d.library.sharedTotal);
    }

    // Top users
    const usageRes = await adminApiClient.getUserUsageList();
    const tbody = document.getElementById('tbody-top-usage');
    if (tbody && usageRes.success && usageRes.data) {
      if (usageRes.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No hay registros de consumo aún.</td></tr>`;
      } else {
        tbody.innerHTML = usageRes.data.slice(0, 5).map((u) => {
          const limitText = u.monthlyTokenLimit ? u.monthlyTokenLimit.toLocaleString() : 'Ilimitado';
          const pct = u.percentageUsed !== null ? `${u.percentageUsed}%` : '-';
          return `
            <tr>
              <td><strong>${escapeHtml(u.displayName)}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(u.email)}</span></td>
              <td><span class="role-pill role-${escapeHtml(u.role.toLowerCase())}">${escapeHtml(u.role)}</span></td>
              <td><span class="status-pill status-${escapeHtml(u.status.toLowerCase())}">${u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></td>
              <td>${u.requestsMonth.toLocaleString()}</td>
              <td><strong>${u.totalTokensMonth.toLocaleString()}</strong></td>
              <td>${limitText}</td>
              <td>${pct}</td>
            </tr>
          `;
        }).join('');
      }
    }
  }

  document.getElementById('btn-refresh-summary')?.addEventListener('click', loadSummary);

  // 4. VISTA USUARIOS
  const filterSearch = document.getElementById('filter-user-search') as HTMLInputElement;
  const filterRole = document.getElementById('filter-user-role') as HTMLSelectElement;
  const filterStatus = document.getElementById('filter-user-status') as HTMLSelectElement;

  async function loadUsers() {
    const tbody = document.getElementById('tbody-users');
    if (!tbody) return;

    tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Cargando...</td></tr>`;

    const res = await adminApiClient.getUsers({
      search: filterSearch?.value || undefined,
      role: filterRole?.value || undefined,
      status: filterStatus?.value || undefined,
    });

    if (res.success && res.data) {
      if (res.data.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No se encontraron usuarios.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.items.map((u) => {
        const limitText = u.monthlyTokenLimit ? `${u.monthlyTokenLimit.toLocaleString()} tokens` : 'Ilimitado';
        const lastAccess = u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'Nunca';
        const toggleStatusText = u.status === 'ACTIVE' ? 'Desactivar' : 'Activar';
        const toggleStatusClass = u.status === 'ACTIVE' ? 'btn-action-danger' : '';

        return `
          <tr>
            <td><strong>${escapeHtml(u.displayName)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="role-pill role-${escapeHtml(u.role.toLowerCase())}">${escapeHtml(u.role)}</span></td>
            <td><span class="status-pill status-${escapeHtml(u.status.toLowerCase())}">${u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></td>
            <td>${limitText}</td>
            <td>${lastAccess}</td>
            <td>
              <div class="table-actions-cell">
                <button type="button" class="btn-action-sm btn-edit-user" data-id="${escapeHtml(u.id)}" data-name="${escapeHtml(u.displayName)}" data-role="${escapeHtml(u.role)}">Editar</button>
                <button type="button" class="btn-action-sm ${toggleStatusClass} btn-toggle-status" data-id="${escapeHtml(u.id)}" data-status="${escapeHtml(u.status)}">${toggleStatusText}</button>
                <button type="button" class="btn-action-sm btn-reset-pwd" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(u.email)}">Reset Clave</button>
                <button type="button" class="btn-action-sm btn-set-limit" data-id="${escapeHtml(u.id)}" data-name="${escapeHtml(u.displayName)}" data-limit="${u.monthlyTokenLimit ?? ''}">Límite</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      // Bind actions
      document.querySelectorAll('.btn-edit-user').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          const name = (btn as HTMLElement).dataset.name!;
          const role = (btn as HTMLElement).dataset.role!;
          (document.getElementById('eu-id') as HTMLInputElement).value = id;
          (document.getElementById('eu-displayName') as HTMLInputElement).value = name;
          (document.getElementById('eu-role') as HTMLSelectElement).value = role;
          openModal('modal-edit-user');
        });
      });

      document.querySelectorAll('.btn-toggle-status').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id!;
          const currentStatus = (btn as HTMLElement).dataset.status!;
          const nextStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

          if (currentStatus === 'ACTIVE') {
            const confirmed = window.confirm('¿Desactivar este usuario? Perderá acceso y se revocarán todas sus sesiones inmediatamente.');
            if (!confirmed) return;
          }

          const updateRes = await adminApiClient.updateUserStatus(id, nextStatus);
          if (updateRes.success) {
            showAdminToast(`Usuario ${nextStatus === 'ACTIVE' ? 'activado' : 'desactivado'} con éxito`, 'success');
            await loadUsers();
          } else {
            showAdminToast(updateRes.error?.message || 'Error al actualizar estado', 'error');
          }
        });
      });

      document.querySelectorAll('.btn-reset-pwd').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          const email = (btn as HTMLElement).dataset.email!;
          (document.getElementById('rp-id') as HTMLInputElement).value = id;
          (document.getElementById('rp-user-info') as HTMLElement).textContent = `Usuario: ${email}`;
          (document.getElementById('rp-password') as HTMLInputElement).value = '';
          openModal('modal-reset-password');
        });
      });

      document.querySelectorAll('.btn-set-limit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          const name = (btn as HTMLElement).dataset.name!;
          const limit = (btn as HTMLElement).dataset.limit!;
          (document.getElementById('limit-id') as HTMLInputElement).value = id;
          (document.getElementById('limit-user-info') as HTMLElement).textContent = `Usuario: ${name}`;
          (document.getElementById('limit-input') as HTMLInputElement).value = limit;
          openModal('modal-limit');
        });
      });
    }
  }

  filterSearch?.addEventListener('input', () => loadUsers());
  filterRole?.addEventListener('change', () => loadUsers());
  filterStatus?.addEventListener('change', () => loadUsers());

  // Formulario Crear Usuario
  document.getElementById('btn-open-create-user')?.addEventListener('click', () => {
    (document.getElementById('form-create-user') as HTMLFormElement)?.reset();
    openModal('modal-create-user');
  });

  document.getElementById('form-create-user')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const displayName = (document.getElementById('cu-displayName') as HTMLInputElement).value.trim();
    const email = (document.getElementById('cu-email') as HTMLInputElement).value.trim();
    const temporaryPassword = (document.getElementById('cu-password') as HTMLInputElement).value;
    const role = (document.getElementById('cu-role') as HTMLSelectElement).value;
    const limitRaw = (document.getElementById('cu-limit') as HTMLInputElement).value;
    const monthlyTokenLimit = limitRaw ? parseInt(limitRaw, 10) : null;

    const res = await adminApiClient.createUser({ displayName, email, temporaryPassword, role, monthlyTokenLimit });
    if (res.success) {
      showAdminToast('Usuario creado correctamente con contraseña temporal', 'success');
      closeModal('modal-create-user');
      await loadUsers();
    } else {
      showAdminToast(res.error?.message || 'Error al crear usuario', 'error');
    }
  });

  // Formulario Editar Usuario
  document.getElementById('form-edit-user')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (document.getElementById('eu-id') as HTMLInputElement).value;
    const displayName = (document.getElementById('eu-displayName') as HTMLInputElement).value.trim();
    const role = (document.getElementById('eu-role') as HTMLSelectElement).value as 'ADMIN' | 'USER';

    const res = await adminApiClient.updateUser(id, { displayName, role });
    if (res.success) {
      showAdminToast('Usuario actualizado correctamente', 'success');
      closeModal('modal-edit-user');
      await loadUsers();
    } else {
      showAdminToast(res.error?.message || 'Error al actualizar usuario', 'error');
    }
  });

  // Formulario Reset Password
  document.getElementById('form-reset-password')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (document.getElementById('rp-id') as HTMLInputElement).value;
    const temporaryPassword = (document.getElementById('rp-password') as HTMLInputElement).value;

    const res = await adminApiClient.resetPassword(id, temporaryPassword);
    if (res.success) {
      showAdminToast('Contraseña temporal actualizada. El usuario deberá cambiarla al ingresar.', 'success');
      closeModal('modal-reset-password');
    } else {
      showAdminToast(res.error?.message || 'Error al resetear contraseña', 'error');
    }
  });

  // Formulario Límite de Tokens
  document.getElementById('form-limit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (document.getElementById('limit-id') as HTMLInputElement).value;
    const rawVal = (document.getElementById('limit-input') as HTMLInputElement).value;
    const limit = rawVal && parseInt(rawVal, 10) > 0 ? parseInt(rawVal, 10) : null;

    const res = await adminApiClient.updateUsageLimit(id, limit);
    if (res.success) {
      showAdminToast('Límite de consumo actualizado exitosamente', 'success');
      closeModal('modal-limit');
      await loadUsers();
    } else {
      showAdminToast(res.error?.message || 'Error al actualizar límite', 'error');
    }
  });

  // 5. VISTA CONSUMO
  async function loadUsage() {
    const tbody = document.getElementById('tbody-usage');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">Cargando métricas...</td></tr>`;

    const res = await adminApiClient.getUserUsageList();
    if (res.success && res.data) {
      if (res.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="10" style="text-align: center; color: var(--text-muted);">No hay usuarios registrados.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.map((u: UserUsageMetric) => {
        let progressHtml = '<span style="color:var(--text-muted); font-size:0.75rem;">Sin límite</span>';
        if (u.monthlyTokenLimit) {
          const pct = u.percentageUsed ?? 0;
          let fillClass = '';
          if (pct >= 90) fillClass = 'fill-danger';
          else if (pct >= 75) fillClass = 'fill-warn';

          progressHtml = `
            <div class="progress-container">
              <div class="progress-bar-bg">
                <div class="progress-bar-fill ${fillClass}" style="width: ${Math.min(pct, 100)}%;"></div>
              </div>
              <span class="progress-label">${pct}% (${u.totalTokensMonth.toLocaleString()} / ${u.monthlyTokenLimit.toLocaleString()})</span>
            </div>
          `;
        }

        return `
          <tr>
            <td><strong>${escapeHtml(u.displayName)}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${escapeHtml(u.email)}</span></td>
            <td><span class="status-pill status-${escapeHtml(u.status.toLowerCase())}">${u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></td>
            <td>${u.requestsToday.toLocaleString()}</td>
            <td>${u.requestsMonth.toLocaleString()}</td>
            <td>${u.inputTokensMonth.toLocaleString()}</td>
            <td>${u.outputTokensMonth.toLocaleString()}</td>
            <td><strong>${u.totalTokensMonth.toLocaleString()}</strong></td>
            <td>${progressHtml}</td>
            <td>$${u.estimatedCostUsd.toFixed(4)} USD</td>
            <td>
              <button type="button" class="btn-action-sm btn-set-limit" data-id="${escapeHtml(u.userId)}" data-name="${escapeHtml(u.displayName)}" data-limit="${u.monthlyTokenLimit ?? ''}">Ajustar Límite</button>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('#tbody-usage .btn-set-limit').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          const name = (btn as HTMLElement).dataset.name!;
          const limit = (btn as HTMLElement).dataset.limit!;
          (document.getElementById('limit-id') as HTMLInputElement).value = id;
          (document.getElementById('limit-user-info') as HTMLElement).textContent = `Usuario: ${name}`;
          (document.getElementById('limit-input') as HTMLInputElement).value = limit;
          openModal('modal-limit');
        });
      });
    }
  }

  document.getElementById('btn-refresh-usage')?.addEventListener('click', loadUsage);

  // 6. VISTA BIBLIOTECA COMPARTIDA
  async function loadSharedLibrary() {
    const tbody = document.getElementById('tbody-shared-library');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Cargando...</td></tr>`;

    const [libRes, catRes] = await Promise.all([
      adminApiClient.getSharedLibrary(),
      adminApiClient.getCategories(),
    ]);

    // Llenar select de categorías en modal de forma segura
    const catSelect = document.getElementById('tmpl-category') as HTMLSelectElement;
    if (catSelect && catRes.success && catRes.data) {
      catSelect.innerHTML = catRes.data.map((c) => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
    }

    if (libRes.success && libRes.data) {
      if (libRes.data.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No hay plantillas compartidas creadas aún.</td></tr>`;
        return;
      }

      tbody.innerHTML = libRes.data.map((item: SharedTemplate) => {
        const excerpt = item.content.length > 80 ? item.content.slice(0, 80) + '...' : item.content;
        const dateStr = new Date(item.createdAt).toLocaleDateString('es-ES');
        return `
          <tr>
            <td><strong>${escapeHtml(item.title)}</strong></td>
            <td><span class="status-pill" style="background:#e0e7ff; color:#3730a3;">${escapeHtml(item.category.name)}</span></td>
            <td style="color:var(--text-secondary); max-width: 320px;">${escapeHtml(excerpt)}</td>
            <td>${dateStr}</td>
            <td>
              <div class="table-actions-cell">
                <button type="button" class="btn-action-sm btn-edit-tmpl" data-id="${escapeHtml(item.id)}" data-title="${escapeHtml(item.title)}" data-content="${encodeURIComponent(item.content)}" data-category="${escapeHtml(item.categoryId)}">Editar</button>
                <button type="button" class="btn-action-sm btn-action-danger btn-del-tmpl" data-id="${escapeHtml(item.id)}">Eliminar</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.btn-edit-tmpl').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = (btn as HTMLElement).dataset.id!;
          const title = (btn as HTMLElement).dataset.title!;
          const content = decodeURIComponent((btn as HTMLElement).dataset.content!);
          const category = (btn as HTMLElement).dataset.category!;
          (document.getElementById('modal-template-title') as HTMLElement).textContent = 'Editar Plantilla Compartida';
          (document.getElementById('tmpl-id') as HTMLInputElement).value = id;
          (document.getElementById('tmpl-title') as HTMLInputElement).value = title;
          (document.getElementById('tmpl-category') as HTMLSelectElement).value = category;
          (document.getElementById('tmpl-content') as HTMLTextAreaElement).value = content;
          openModal('modal-template');
        });
      });

      document.querySelectorAll('.btn-del-tmpl').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id!;
          const confirmed = window.confirm('¿Deseas eliminar esta plantilla compartida del equipo?');
          if (!confirmed) return;

          const res = await adminApiClient.deleteSharedTemplate(id);
          if (res.success) {
            showAdminToast('Plantilla eliminada correctamente', 'success');
            await loadSharedLibrary();
          } else {
            showAdminToast(res.error?.message || 'Error al eliminar', 'error');
          }
        });
      });
    }
  }

  document.getElementById('btn-open-create-template')?.addEventListener('click', () => {
    (document.getElementById('form-template') as HTMLFormElement)?.reset();
    (document.getElementById('modal-template-title') as HTMLElement).textContent = 'Nueva Plantilla Compartida';
    (document.getElementById('tmpl-id') as HTMLInputElement).value = '';
    openModal('modal-template');
  });

  document.getElementById('form-template')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = (document.getElementById('tmpl-id') as HTMLInputElement).value;
    const title = (document.getElementById('tmpl-title') as HTMLInputElement).value.trim();
    const categoryId = (document.getElementById('tmpl-category') as HTMLSelectElement).value;
    const content = (document.getElementById('tmpl-content') as HTMLTextAreaElement).value.trim();

    if (id) {
      const res = await adminApiClient.updateSharedTemplate(id, { title, categoryId, content });
      if (res.success) {
        showAdminToast('Plantilla compartida actualizada', 'success');
        closeModal('modal-template');
        await loadSharedLibrary();
      } else {
        showAdminToast(res.error?.message || 'Error al actualizar plantilla', 'error');
      }
    } else {
      const res = await adminApiClient.createSharedTemplate({ title, categoryId, content });
      if (res.success) {
        showAdminToast('Plantilla compartida creada exitosamente', 'success');
        closeModal('modal-template');
        await loadSharedLibrary();
      } else {
        showAdminToast(res.error?.message || 'Error al crear plantilla', 'error');
      }
    }
  });

  // 7. VISTA ACTIVIDAD Y AUDITORÍA
  const filterAuditAction = document.getElementById('filter-audit-action') as HTMLSelectElement;

  async function loadAuditLogs() {
    const tbody = document.getElementById('tbody-audit');
    if (!tbody) return;
    tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">Cargando...</td></tr>`;

    const res = await adminApiClient.getAuditLogs({
      action: filterAuditAction?.value || undefined,
    });

    if (res.success && res.data) {
      if (res.data.items.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted);">No se registran eventos de auditoría.</td></tr>`;
        return;
      }

      tbody.innerHTML = res.data.items.map((a) => {
        const timeStr = new Date(a.createdAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'medium' });
        const metaStr = a.metadata ? Object.entries(a.metadata).map(([k, v]) => `${escapeHtml(k)}: ${escapeHtml(v)}`).join(', ') : '-';
        return `
          <tr>
            <td>${timeStr}</td>
            <td><strong>${escapeHtml(a.actor.displayName)}</strong> (${escapeHtml(a.actor.email)})</td>
            <td><span class="status-pill status-active">${escapeHtml(a.action)}</span></td>
            <td>${escapeHtml(a.targetType)}</td>
            <td style="font-size:0.75rem; color:var(--text-secondary);">${metaStr}</td>
          </tr>
        `;
      }).join('');
    }
  }

  filterAuditAction?.addEventListener('change', () => loadAuditLogs());
  document.getElementById('btn-refresh-audit')?.addEventListener('click', loadAuditLogs);

  // 8. VISTA SEGURIDAD
  async function loadSecurity() {
    const res = await adminApiClient.getSessionsSummary();
    if (res.success && res.data) {
      const elActive = document.getElementById('kpi-sessions-active');
      const elRevoked = document.getElementById('kpi-sessions-revoked');
      if (elActive) elActive.textContent = res.data.activeSessions.toLocaleString();
      if (elRevoked) elRevoked.textContent = res.data.revokedSessions.toLocaleString();
    }

    const usersRes = await adminApiClient.getUsers({ limit: 100 });
    const tbody = document.getElementById('tbody-sessions-users');
    if (tbody && usersRes.success && usersRes.data) {
      tbody.innerHTML = usersRes.data.items.map((u) => {
        return `
          <tr>
            <td><strong>${escapeHtml(u.displayName)}</strong></td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="role-pill role-${escapeHtml(u.role.toLowerCase())}">${escapeHtml(u.role)}</span></td>
            <td><span class="status-pill status-${escapeHtml(u.status.toLowerCase())}">${u.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}</span></td>
            <td>
              <button type="button" class="btn-action-sm btn-action-danger btn-revoke-user-sessions" data-id="${escapeHtml(u.id)}">Revocar Sesiones</button>
            </td>
          </tr>
        `;
      }).join('');

      document.querySelectorAll('.btn-revoke-user-sessions').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = (btn as HTMLElement).dataset.id!;
          const confirmed = window.confirm('¿Revocar todas las sesiones de este usuario? Deberá iniciar sesión nuevamente.');
          if (!confirmed) return;

          const revokeRes = await adminApiClient.revokeUserSessions(id);
          if (revokeRes.success) {
            showAdminToast('Sesiones revocadas exitosamente', 'success');
            await loadSecurity();
          } else {
            showAdminToast(revokeRes.error?.message || 'Error al revocar sesiones', 'error');
          }
        });
      });
    }
  }

  // 8. VISTA ESTADO DEL SISTEMA (MONITOREO)
  async function loadSystemHealth() {
    const elBackendStatus = document.getElementById('system-backend-status');
    const elBackendMeta = document.getElementById('system-backend-meta');
    const elDbStatus = document.getElementById('system-db-status');
    const elDbMeta = document.getElementById('system-db-meta');
    const elAiStatus = document.getElementById('system-ai-status');
    const elAiMeta = document.getElementById('system-ai-meta');

    const elBackendVer = document.getElementById('sys-backend-version');
    const elExtVer = document.getElementById('sys-ext-version');
    const elEnv = document.getElementById('sys-environment');
    const elUptime = document.getElementById('sys-uptime');
    const elMem = document.getElementById('sys-memory');
    const elAiMonth = document.getElementById('sys-ai-month');
    const elAiCost = document.getElementById('sys-ai-cost');
    const elLastCheck = document.getElementById('sys-last-check');

    if (elBackendStatus) elBackendStatus.textContent = '⏳ Comprobando...';
    if (elDbStatus) elDbStatus.textContent = '⏳ Comprobando...';
    if (elAiStatus) elAiStatus.textContent = '⏳ Comprobando...';

    const res = await adminApiClient.getSystemHealth();
    if (res.success && res.data) {
      const d = res.data;
      if (elBackendStatus) {
        elBackendStatus.textContent = d.status === 'healthy' ? '🟢 Operativo' : d.status === 'degraded' ? '🟡 Degradado' : '🔴 No disponible';
      }
      if (elBackendMeta) {
        elBackendMeta.textContent = `v${d.version?.backend || '1.0.0'} • Uptime: ${Math.floor((d.uptimeSeconds || 0) / 60)} min`;
      }

      if (elDbStatus) {
        elDbStatus.textContent = d.database?.status === 'connected' ? '🟢 Conectada' : d.database?.status === 'slow' ? '🟡 Lenta' : '🔴 No disponible';
      }
      if (elDbMeta) {
        elDbMeta.textContent = `Latencia: ${d.database?.latencyMs ?? 0} ms`;
      }

      if (elAiStatus) {
        elAiStatus.textContent = d.ai?.status === 'operational' ? '🟢 Operativo' : '🟡 Con incidencias';
      }
      if (elAiMeta) {
        elAiMeta.textContent = `${d.ai?.model || 'Llama 3.1 8B'} • ${d.ai?.requestsToday || 0} hoy`;
      }

      if (elBackendVer) elBackendVer.textContent = d.version?.backend || '1.0.0';
      if (elExtVer) elExtVer.textContent = '1.0.0';
      if (elEnv) elEnv.textContent = d.environment === 'production' ? 'Producción (Cloud)' : (d.environment || 'Local');

      const uptimeSec = d.uptimeSeconds || 0;
      const hours = Math.floor(uptimeSec / 3600);
      const minutes = Math.floor((uptimeSec % 3600) / 60);
      const seconds = uptimeSec % 60;
      if (elUptime) elUptime.textContent = `${hours}h ${minutes}m ${seconds}s`;

      if (elMem) {
        elMem.textContent = `Heap: ${d.memory?.heapUsedMb ?? 0} MB / Total: ${d.memory?.heapTotalMb ?? 0} MB (RSS: ${d.memory?.rssMb ?? 0} MB)`;
      }
      if (elAiMonth) {
        elAiMonth.textContent = `${(d.ai?.requestsMonth || 0).toLocaleString()} consultas (${(d.ai?.totalTokensMonth || 0).toLocaleString()} tokens)`;
      }
      if (elAiCost) elAiCost.textContent = d.ai?.estimatedCostUsd || '$0.00';
      if (elLastCheck) elLastCheck.textContent = d.timestamp ? new Date(d.timestamp).toLocaleTimeString() : new Date().toLocaleTimeString();
    } else {
      if (elBackendStatus) elBackendStatus.textContent = '🔴 No disponible';
      if (elDbStatus) elDbStatus.textContent = '🔴 Sin conexión';
      if (elAiStatus) elAiStatus.textContent = '🔴 Desconectado';
      showAdminToast('No se pudo obtener el estado completo del sistema.', 'error');
    }
  }

  document.getElementById('btn-refresh-system-health')?.addEventListener('click', async () => {
    await loadSystemHealth();
    showAdminToast('Estado del sistema actualizado.', 'success');
  });

  // Cargar vista inicial
  await switchView('resumen');
});
