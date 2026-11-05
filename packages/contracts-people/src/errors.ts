/** Claves de error propias de people (además de las `common.*`). */
export const PEOPLE_ERRORS = [
	/** H-NOTFOUND */
	'people.employee_not_found',
	/** H-NOTFOUND */
	'people.absence_not_found',
	/** Se pisa con otra ausencia del mismo empleado (H-EM002). */
	'people.absence_overlap',
	/** Empieza antes del ingreso. */
	'people.absence_before_hire',
	/** Termina después del egreso. */
	'people.absence_after_exit',
	/** Ese usuario de identity ya está vinculado a otro empleado. */
	'people.user_taken',
	/** El papel no tiene foto guardada (H-NOTFOUND). */
	'people.photo_not_found',
	/** La foto de un papel no es una imagen o PDF que se guarde (H-IM001). */
	'people.photo_invalid',
	/** Tabla auxiliar que no existe (H-NOTFOUND). */
	'people.lookup_not_found'
] as const
export type PeopleErrorKey = (typeof PEOPLE_ERRORS)[number]
