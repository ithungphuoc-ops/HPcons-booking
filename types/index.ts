export type Role = 'owner' | 'admin' | 'manager' | 'employee'

export type EmploymentStatus = 'active' | 'maternity' | 'on_leave' | 'transferred' | 'resigned'

export type User = {
  id: string
  email: string
  full_name: string
  phone?: string | null
  avatar_url?: string | null
  role: Role
  department_id?: string | null
  department?: string | null
  title?: string | null
  address?: string | null
  manager_id?: string | null
  manager?: { full_name: string } | null
  employee_code?: string | null
  employment_status?: EmploymentStatus
  created_at: string
  settings?: unknown
}

export type Department = {
  id: string
  name: string
  description?: string
  created_at: string
}

export type Worksite = {
  id: string
  name: string
  address: string
  latitude: number
  longitude: number
  radius_meters: number
  location_type: 'fixed' | 'flexible'
  is_active: boolean
  created_at: string
}

export type AttendanceStatus = 'on_time' | 'late' | 'early_leave' | 'absent' | 'outside_range'

export type Attendance = {
  id: string
  user_id: string
  worksite_id: string
  check_in_at?: string
  check_out_at?: string
  check_in_lat?: number
  check_in_lng?: number
  check_out_lat?: number
  check_out_lng?: number
  status: AttendanceStatus
  note?: string
  date: string
  user?: User
  worksite?: Worksite
}

export type AppItem = {
  id: string
  name: string
  description: string
  icon: string
  color: string
  href: string
  is_active: boolean
  roles: Role[]
}
