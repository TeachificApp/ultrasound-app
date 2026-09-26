/**
 * A positive capacity is a finite seat limit. Legacy workshop records may use
 * zero for "no limit"; treating it as unlimited avoids turning a sales-open
 * instance with zero enrollments into a false sold-out instance.
 */
export function hasFiniteWorkshopCapacity(capacity: number | null | undefined): capacity is number {
  return capacity != null && capacity > 0;
}
