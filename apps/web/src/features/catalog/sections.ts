/** Secciones del catálogo (navegación y panel de admin). Cada tarea del módulo agrega la suya. */
export const CATALOG_SECTIONS = [
  {
    path: '/admin/productos',
    label: 'Productos',
    description: 'Lo que se vende: precio, categoría y receta',
  },
  {
    path: '/admin/categorias',
    label: 'Categorías',
    description: 'Agrupan los productos en la caja',
  },
  {
    path: '/admin/insumos',
    label: 'Insumos',
    description: 'Lo que consume cada receta (g, ml o unidades)',
  },
] as const;
