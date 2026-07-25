# Bitácora — Módulo Finanzas unificado (`/finanzas-nuevo`)

> Logbook del rediseño financiero de AJÚA en ajua-react.
> Objetivo del usuario (Ricardo): **un solo lugar** para cargar pagos, cobros, gastos, sueldos y rentas,
> con mejores controles y para **empezar a llevar estados de resultados y sacar rentabilidades directas**.
> Antes había que meterse a muchas pestañas para cargar 1 pago.

---

## Estado actual: Fase 1–3 completas y desplegadas (rama `staging` → Vercel)

Corre en **ruta paralela `/finanzas-nuevo`**, EN SIMULTÁNEO al `/finanzas` viejo (Clasificador banco,
PnL, FEL, Walmart, Importadores) que sigue **INTACTO**. En el menú aparecen los dos:
`💰 Finanzas` (viejo) y `✨ Finanzas (nuevo)`. Estrategia: validar lado a lado, después absorber el viejo.

### Commits (rama staging)
| Commit | Fase | Contenido |
|--------|------|-----------|
| `158b239` | 1  | Layout + Dashboard + Movimientos + 3 modales (Pago/Cobro/GastoOp) + `getFinanzasPerms` |
| `0323eca` | 2A | Usuarios y permisos (admin) + Estado de resultados |
| `f6ec4de` | 2B | Empleados — CxP personal desde AL |
| `fa7e26d` | 2C | Grupos importación — rentabilidad por contenedor |
| `6c2f32a` | 3  | CRUD completo (ver/editar/anular) + export Excel |
| `932632a` | 4  | Ruteo a estados de cuenta reales + pantalla única de registro |
| `(fase 5)` | 5  | **Estados de cuenta embebidos en el hub (Proveedores + Clientes)** |

---

## Fase C — Cuentas por Pagar consolidado (2026-07-24/25)

El corazón del módulo según Ricardo: **UN solo lugar con todos los gastos CxP para registro y
control de pago**. `FinanzasCxP.jsx` (nav "💳 Cuentas por Pagar", perm ver_movimientos) consolida 3 fuentes:
- **Proveedores** con saldo pendiente (agrupa `cuentasProveedores`, saldo vía `saldoProveedor()`)
- **Empleados** = nómina de la semana actual (días de AL × salario − anticipos), no pagada
- **Gastos** pendientes (`movimientos_finanzas` estado pendiente/pendiente_aprobacion)

Cada fila tiene botón **Pagar** → modal que registra en el ledger correcto:
- proveedor → `cuentasProveedores` {tipo:'pago'} (permite abono parcial)
- empleado → `perPagos` (schema igual a Personal.jsx) + marca anticipos `descontado`
- gasto → `movimientos_finanzas` estado='pagado'

`cxpHelpers.js` replica (sin tocar) weekOf/weekEnd/matchEmpNombre/diasSemana (de Personal) y
saldoProveedor (de useCuentaProveedor) — para no acoplar ni romper los módulos que funcionan.

### Revisión guardian-datos: PRECAUCIÓN → fixes aplicados
- **Guard anti-doble-pago robusto**: cuenta empleado "ya pagado esta semana" si hay perPagos con
  semana===actual O fecha dentro del rango lunes→domingo (el `semana` viejo es texto editable).
- **Gate de aprobación**: gastos `pendiente_aprobacion` solo se pagan con `aprobar_pendientes` y
  monto ≤ `aprobar_hasta` (si no, un usuario básico aprobaría sobre-tope de supervisor).
- Schema perPagos coincide con Personal; saldoProveedor replica fiel (mismos números que Cta. Proveedores).

### ⚠️ Riesgo residual (documentado, NO ir a producción sin resolver)
- **Carrera concurrente**: perPagos/perAnticipo se escriben con addDoc + updateDoc secuencial, SIN
  runTransaction. Dos personas pagando al mismo empleado a la vez (o desde Personal.jsx y CxP)
  pueden doble-pagar o descontar un anticipo dos veces. Es el MISMO riesgo que ya tiene Personal.jsx,
  ahora con 2 puntos de entrada. Mitigación real pendiente: runTransaction/writeBatch + re-lectura.
  **Mientras tanto: que pague una sola persona a la vez.** OK para staging/pruebas.
- Match empleado por nombre (sensible a rename); anticipo no incluye horas extra en el neto (igual que Personal).

---

## Fase B — Absorción del módulo viejo + un solo Finanzas (2026-07-23)

El `/finanzas` viejo (Clasificador banco, PnL, FEL, Walmart, Importadores) se **absorbe dentro del hub**
reusando el componente tal cual (no se reescribe):
- Ruta hub renombrada: `/finanzas-nuevo` → **`/finanzas`** (un solo Finanzas). Sub-rutas: movimientos,
  ventas, proveedores, clientes, empleados, grupos, resultados, **bancos**, usuarios.
- El módulo viejo (`Finanzas.jsx` = `FinanzasModule`) se monta en `/finanzas/bancos`, nav "🏦 Bancos y P&L".
- Menú principal: se quita el item duplicado "Bancos y P&L"; "✨ Finanzas" apunta a `/finanzas`.
- Redirects: `/finanzas-nuevo` y `/finanzas-nuevo/*` → `/finanzas` (preserva sub-ruta con `RedirectFinanzasNuevo`).
- "Bancos y P&L" gateado por `ver_resultados` (muestra utilidad/P&L, misma sensibilidad que Estado de resultados).
  Nota: el módulo viejo NO respeta los permisos granulares internamente (muestra P&L a quien llega); si se
  necesita, agregar flag `ver_bancos` dedicado más adelante.
Revisado por code-reviewer: APROBADO, sin bloqueantes/mayores. areaForPath resuelve `/finanzas/*` → admin sin falso-match.

---

## Fase 6 — Navegación por áreas + Ventas por XML/FEL (2026-07-23)

**Navegación (3 áreas):** Ricardo no quería un sidebar largo con divisor, sino pantalla de entrada
con botones grandes. `AreaSelector.jsx` (/areas): 3 botones — Administración, Operación, Cumplimiento.
`areas.js` config (AREAS + SECTION_AREA). `Layout.jsx` deriva el área activa de la ruta y filtra el
menú a esa área + switcher de 3 iconos arriba. Login y / → /areas.

**Ventas por FEL (XML):** `FinanzasVentas.jsx` (nav "Ventas (FEL)", perm cargar_cobros). Sube XML de
facturas EMITIDAS → auto-matchea cliente por NIT (o nombre como fallback), lo crea si no existe →
guarda como despacho en `cuentasClientes` (CxC). `felParser.js` = parser FEL compartido.
Revisado por guardian-datos, fixes aplicados:
- **Idempotencia**: id del despacho = `fel_<uuid>` (setDoc) → re-subir el mismo XML NO duplica.
- Bloquea carga mientras clientes/cxCli.loading (si no, dedup vacío duplicaba todo).
- Consumidor Final (sin NIT) → un solo cliente, no uno por factura.
- Match por nombre como fallback (clientes sin RTU).
- Crea cliente solo con `rtu` (sin campo `nit` fantasma, homologado al schema de Admin).
Walmart (isalidas) queda como su propio flujo, NO se toca (decisión de Ricardo).
Venta manual (ModalRegistrar → Venta) sigue como respaldo.

---

## Fase 5 — Estados de cuenta embebidos (2026-07-23)

Cierra la pregunta de Ricardo "¿dónde veré los estados de cuenta?": ahora se ven DENTRO del hub.
- `FinanzasProveedores.jsx` — selector proveedor + saldo (comprado/rechazos/pagado/saldo) + movimientos con saldo acumulado. **Reusa `useCuentaProveedor`** (misma lógica probada de Cuentas Proveedores).
- `FinanzasClientes.jsx` — selector cliente + CxC (vendido/notas/cobrado/saldo) + movimientos. **Reusa `useCuentaCliente`**.
- Nav: nuevos items "Cta. Proveedores" y "Cta. Clientes" (gateados por `ver_movimientos`).
- Cada página linkea al módulo viejo completo (↗) para operaciones avanzadas.
- Read-only: para registrar se usa Movimientos → Registrar (que ya rutea a estas colecciones).
- Empleados (anticipos) ya tenía su página (CxP desde AL); su estado de cuenta de anticipos queda pendiente de sumar.

---

## Fase 4 — Ruteo a estados de cuenta (2026-07-23) ⭐ CAMBIO IMPORTANTE

Ricardo pidió: **una sola pantalla** donde el que ayuda registra pagos/cobros/ventas, y que cada
cosa caiga en el **estado de cuenta REAL que ya existe** (no una lista plana duplicada). Un pago a
proveedor debe salir en Cuentas Proveedores; empleados con pago/abono; separar todo de BPM.

### Mapa de ruteo (ModalRegistrar.jsx → colección real)
| Registrás | Colección destino | Schema clave | Estado de cuenta que alimenta |
|-----------|-------------------|--------------|-------------------------------|
| Pago proveedor | `cuentasProveedores` | `{tipo:'pago', proveedorId, monto, metodoPago, descripcion}` | baja saldo del proveedor |
| Pago/anticipo empleado | `perAnticipo` | `{empleado:NOMBRE, monto, fecha, concepto, estado:'pendiente'}` | anticipo pendiente, se descuenta en nómina |
| Cobro cliente (CxC) | `cuentasClientes` | `{tipo:'pago', clienteId, monto, metodoPago}` | baja lo que debe el cliente |
| Venta | `cuentasClientes` | `{tipo:'despacho', clienteId, totalVenta}` | sube CxC |
| Gasto suelto (servicio/renta/impuesto/importación/otro) | `movimientos_finanzas` | `{tipo:'pago', categoria, concepto, monto}` | ledger propio de Finanzas |

Empleado se matchea **por nombre** (así lo hace la nómina en `Personal.jsx`, no por id). Verificado
por guardian-datos: schemas coinciden exacto, escrituras 100% aditivas (addDoc), cero riesgo de datos.

### Piezas nuevas
- `useMovimientosUnificados.js` — LEE 6 colecciones (movimientos_finanzas, cuentasProveedores,
  cuentasClientes, perAnticipo, proveedores, clientes) y las normaliza a UN feed. Cada movimiento:
  `{id, _col, _origen, fecha, flujo:'entra'|'sale', caja:bool, tipoLabel, entidad, concepto, monto, estado}`.
  **`caja`** = movió dinero real (cobro/pago/gasto/anticipo). `caja:false` = devengado (venta a crédito,
  nota crédito) → NO cuenta en totales de caja, se muestra aparte como "Ventas (a cobrar)".
- `modals/ModalRegistrar.jsx` — pantalla ÚNICA: elegís tipo (Pago/Cobro/Venta) → si pago, a quién
  (Proveedor/Empleado/Gasto) → campos → guarda ruteando. Muestra a dónde va cada registro.
- `FinanzasMovimientos` / `Dashboard` / `Resultados` reworkeados para consumir el feed unificado.
  Dashboard: "¿en qué se fue la plata?" desglose por tipo. Resultados: base caja (cobrado − pagado),
  ventas facturadas aparte.
- Anular movimiento: botón ✕ por fila (perms.anular) borra de la colección correcta (`m._col`).

### Revisión de agentes (aplicada)
guardian-datos: **SEGURO** (schemas OK, aditivo). code-reviewer: 5 mayores + 4 menores, TODOS los de
cálculo de plata corregidos: gasto pendiente_aprobacion ya no cuenta como caja; división por base
falsa → muestra '—'; notas de crédito ahora netean ventas; limits subidos a 100k (sin truncar meses);
anular reconectado; badges de estado completos; fallback proveedor. Modales viejos huérfanos eliminados.

### Pendiente de esta fase (para retomar)
- Editar un movimiento (hoy solo anular). Editar cruza 4 colecciones → decidir alcance.
- Venta muestra estado 'pendiente' fijo; no se cruza con sus cobros parciales para mostrar saldo real por venta.
- Grupos importación sigue leyendo solo `movimientos_finanzas`; los pagos a proveedor (ahora en
  cuentasProveedores) no son agrupables aún. Revisar si Grupos debe leer el feed unificado.
- Reglas de seguridad Firestore de las 4 colecciones (no revisadas) antes de exponer en prod.
- Migración futura: `perAnticipo.empleado` de nombre → empleadoId (riesgo si se renombra empleado).

---

## Arquitectura

### Páginas (6) — `src/modules/finanzas/`
- `FinanzasLayout.jsx` — sidebar, filtra items visibles por permiso; ruta padre con `<Outlet/>`
- `FinanzasDashboard.jsx` — KPIs del mes (Entró/Salió/Utilidad/PorCobrar/PorPagar) + vencimientos 7d
- `FinanzasMovimientos.jsx` — tabla + filtros + 4 modales; export Excel
- `FinanzasEmpleados.jsx` — CxP personal (cruza `al` + `empleados`, solo lectura)
- `FinanzasGrupos.jsx` — agrupar movimientos en contenedor → rentabilidad
- `FinanzasResultados.jsx` — estado de resultados contable por mes
- `FinanzasUsuarios.jsx` — admin de permisos granulares por usuario
- `FinanzasPlaceholder.jsx` — comodín (ya sin uso, disponible para páginas futuras)
- `modals/` — ModalNuevoPago, ModalNuevoCobro, ModalNuevoGastoOp, ModalDetalleMovimiento

### Modelo de datos (Firestore — colecciones NUEVAS, no tocan `ajua_bpm/main`)
- **`movimientos_finanzas`**: `{ tipo: 'pago'|'cobro'|'gasto_op', categoria, subcategoria, concepto,
  monto, moneda, fecha, forma_pago, proveedor|cliente, estado, fecha_vencimiento, notas, grupoId,
  creadoPor, creadoEn, editadoPor, editadoEn }`
- **`grupos_finanzas`**: `{ nombre, tipo:'importacion', estado:'abierto'|'cerrado', fecha, creadoEn }`
- Empleados/CxP **no escribe nada**: cruza `al` (turnos, campo `checks[]` con presentes + horasExtras)
  con `empleados` (salarioDia/salarioSemana/tarifaHoraExtra/tipoPago).

### Categorías de pago (7) + formas (2)
importacion · proveedor_local · servicios · rentas · sueldos · impuestos · otros
Formas: **Transferencia · Efectivo** únicamente.

### Estados
`pagado` / `cobrado` (efectivo) · `pendiente` · `pendiente_aprobacion` (gasto op sobre tope) · `cargado`.
**Los totales (Dashboard/Resultados/Grupos) solo cuentan movimientos efectivos.** Anular = borrado real
(no hay estado 'anulado', para no dejar registros a medio contar).

---

## Sistema de permisos — POR USUARIO, no roles fijos

`useAuth.getFinanzasPerms(u)` en `src/hooks/useAuth.jsx`. Devuelve objeto con **19 flags**.
Campo nuevo **`permisos_finanzas`** (objeto) en cada usuario dentro de `ajua_bpm/main`.

**Fallback (aditivo, no rompe usuarios existentes):**
1. `admin` / `superadmin` → `DEFAULT_PERMS_ADMIN` (todo automático)
2. tiene `permisos_finanzas` → ese objeto (merge sobre NO_ACCESS)
3. tiene módulo `finanzas` o `modulos` vacío → `DEFAULT_PERMS_BASIC`
4. resto → `DEFAULT_PERMS_NO_ACCESS`

**Flags:** ver_dashboard, ver_movimientos, ver_empleados, ver_grupos, ver_resultados,
admin_usuarios_finanzas · cargar_pagos, cargar_cobros, cargar_gastos_op, cargar_sueldos ·
marcar_pagado, anular, aprobar_pendientes, aprobar_hasta, exportar · tope_gastos_op, historial_dias ·
hide_utility, hide_sueldos.

**Modo supervisor operativo:** `cargar_gastos_op` + sin cargar_pagos/cobros → solo ve SUS gastos,
últimos N días (`historial_dias`), tope Q directo (`tope_gastos_op`), sobre el tope pasa a
`pendiente_aprobacion` hasta `aprobar_hasta`.

**Presets en la página Usuarios:** Auxiliar admin · Supervisor operativo · Contador · Sin acceso.

**Escritura SEGURA de permisos** (patrón de Admin.jsx): `getDoc` fresco → `map` SOLO el usuario
elegido → `setDoc(doc, {...prev, usuarios: nuevos})`. Preserva TODO el resto del documento crítico.

---

## Roadmap pendiente

### 🔴 Paso grande (solo cuando el nuevo esté validado con data real)
- **Absorber el `/finanzas` viejo**: Clasificador banco + FEL + PnL + Importadores pasan a ser
  sub-página(s) del módulo nuevo (ej. "Bancos y FEL" en el sidebar).
- Después: renombrar ruta `/finanzas-nuevo` → `/finanzas`, quitar el item duplicado del menú,
  archivar `Finanzas.jsx` viejo.

### 🟡 Refinamientos sueltos (sin apuro)
- [ ] Export Excel también en Resultados y Empleados (nómina CxP)
- [ ] Filtro por rango de fechas en Movimientos (hoy es solo por mes en Dashboard/Resultados)
- [ ] Editar categoría/estado de un movimiento sin tener que anular y recargar
- [ ] Conversión de moneda: hoy `montoGTQ` se usa si existe pero no hay UI para setear tipo de cambio
      (MXN/USD entran al total sin convertir salvo que se guarde `montoGTQ`)
- [ ] Rentabilidad por producto/cliente en Resultados (hoy solo por categoría y por grupo)
- [ ] Flujo de aprobación real: quién y dónde aprueba los `pendiente_aprobacion` de supervisores

### ⚠️ Cuidados
- NO tocar Walmart pegado manual (`wiAbrir`) — sigue en uso.
- Guatecompras / Reportes viejos / Walmart Import scraper: YA eliminados.
- Reglas de deploy y cuentas GitHub: ver memoria `project_architecture` / `feedback_github_accounts`.
