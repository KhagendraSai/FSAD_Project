export const USER_ROLES = ['admin', 'teacher', 'student'];

export const USER_ROLE_LABELS = {
  admin: 'Admin',
  teacher: 'Teacher',
  student: 'Student',
};

export const USER_ROLE_HOME = {
  admin: '/admin/home',
  teacher: '/teacher/home',
  student: '/student/home',
};

export function createUser({ id, name, email, password = '', role }) {
  return {
    id,
    name,
    email,
    password,
    role,
  };
}