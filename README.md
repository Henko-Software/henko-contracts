# henko-contracts

Los contratos entre las piezas de Henko, en zod: qué se pide, qué se
responde y qué eventos salen. **Un paquete por módulo**, así cada servicio
depende sólo de los contratos que usa.

| Paquete                                  | Qué define                                                                                                                                                                                                                |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@henko-software/contracts-common`       | piezas que comparten los contratos: `listParam` y `booleanParam` para los filtros de los listados en la query                                                                                                             |
| `@henko-software/contracts-identity`     | API interna de `identity` (sesiones con «ver como», usuarios, dispositivos, organización de la instancia, flags guardados), roles, errores y eventos                                                                      |
| `@henko-software/contracts-flags`        | catálogo de feature flags (las claves copian la nav), valores guardados y efectivos, y el nodo del panel                                                                                                                  |
| `@henko-software/contracts-bff`          | API pública de `henko-bff`, la que usa `henko-web` (sesión, flags, Administración armada con contacts, padrón de ARCA con fiscal)                                                                                         |
| `@henko-software/contracts-console`      | feedback que llega de cada instancia, API de la bandeja y trazas de la Henko Console                                                                                                                                      |
| `@henko-software/contracts-fiscal`       | API interna de `fiscal` (comprobantes con CAE o CAEA, numeración, puntos de venta, padrón), tablas de códigos de ARCA, errores y eventos                                                                                  |
| `@henko-software/contracts-contacts`     | API interna de `contacts`: contactos con roles, condiciones de pago, tablas auxiliares, errores y eventos                                                                                                                 |
| `@henko-software/contracts-ledger`       | API interna de `ledger`: cuenta corriente de clientes y proveedores (movimientos, imputaciones, saldo, antigüedad, vencimientos, ventas por vendedor), plan de cuentas, comandos y eventos que consume y publica, errores |
| `@henko-software/contracts-orchestrator` | API interna del orquestador (flujos, pasos, intentos, arranque idempotente por `commandId`, cancelación), cabecera de idempotencia de los comandos a módulos, errores y eventos                                           |

## Reglas

- **El contrato se cambia acá primero**, y después los servicios.
- **Un cambio que rompe** (sacar un campo, cambiar un tipo) sube el mayor del
  paquete y convive con la versión anterior hasta que nadie la use.
- Los ids son UUIDv7, las fechas ISO en UTC, la plata en centavos.
- Los eventos se nombran `<módulo>.<entidad>.<hecho>.v<n>`.

## Publicar

Subir el `version` del paquete y llegar a `main`.
