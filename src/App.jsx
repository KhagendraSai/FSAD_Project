import React, { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, NavLink, Outlet, Route, Routes, useNavigate } from 'react-router-dom';
import { USER_ROLE_HOME, USER_ROLE_LABELS } from './models/userModel';

const STORAGE_KEYS = {
  currentUser: 'aurora-grade-current-user',
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

async function apiRequest(path, options = {}) {
  const { token, method = 'GET', body } = options;
  const isFormData = body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    ...(body ? { body: isFormData ? body : JSON.stringify(body) } : {}),
  });

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.message || 'Request failed');
  }

  return data;
}

const initialCourses = [];

const initialAssignments = [];

const initialAdminSettings = {
  maintenanceMode: false,
  announcementsEnabled: true,
  autoArchive: true,
};

const AuthContext = React.createContext(null);
const DataContext = React.createContext(null);

function readStorage(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function useStoredState(key, fallback) {
  const [value, setValue] = useState(() => readStorage(key, fallback));

  useEffect(() => {
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue];
}

function useAuth() {
  const value = React.useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthContext');
  return value;
}

function useData() {
  const value = React.useContext(DataContext);
  if (!value) throw new Error('useData must be used within DataContext');
  return value;
}

function formatDate(value) {
  if (!value) return 'TBD';
  return new Date(value).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function isRemoteFileUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value);
}

function canPreviewInline(submission) {
  if (!submission?.fileUrl) return false;
  const mimeType = String(submission.mimeType || '').toLowerCase();
  const fileName = String(submission.fileName || '').toLowerCase();

  if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) return true;
  if (mimeType.startsWith('image/') || mimeType.startsWith('text/')) return true;
  if (mimeType.startsWith('audio/') || mimeType.startsWith('video/')) return true;

  const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
  const isOfficeFile = officeExtensions.some((extension) => fileName.endsWith(extension));
  return isOfficeFile && isRemoteFileUrl(submission.fileUrl);
}

function getPreviewUrl(submission) {
  if (!submission?.fileUrl) return 'about:blank';
  const fileName = String(submission.fileName || '').toLowerCase();
  const officeExtensions = ['.doc', '.docx', '.ppt', '.pptx', '.xls', '.xlsx'];
  const isOfficeFile = officeExtensions.some((extension) => fileName.endsWith(extension));

  if (isOfficeFile && isRemoteFileUrl(submission.fileUrl)) {
    return `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(submission.fileUrl)}`;
  }

  return submission.fileUrl;
}

function daysUntil(value) {
  if (!value) return null;
  const now = new Date();
  const target = new Date(value);
  const oneDay = 1000 * 60 * 60 * 24;
  return Math.round((target.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / oneDay);
}

function courseLabel(course, assignments) {
  return `${course.code} · ${assignments.filter((assignment) => assignment.courseId === course.id).length} assignments`;
}

function getFileNameFromPath(value) {
  if (!value || typeof value !== 'string') return 'submission';
  return value.split(/[\\/]/).pop() || 'submission';
}

function normalizeSubmission(submission) {
  const submissionPath = submission.submissionPath || '';
  const isRemote = isRemoteFileUrl(submissionPath);
  return {
    id: submission.id,
    studentName: submission.submittedBy || 'Student',
    submittedAt: submission.submittedAt,
    fileName: submission.originalFileName || (isRemote ? 'Solution Link' : getFileNameFromPath(submissionPath)),
    fileUrl: isRemote ? submissionPath : submission.id ? `${API_BASE_URL}/api/submissions/${submission.id}/file` : '',
    mimeType: submission.mimeType || '',
    grade: submission.grade ?? null,
    feedback: submission.feedback ?? '',
  };
}

function normalizeAssignment(assignment) {
  return {
    id: assignment.id,
    courseId: assignment.courseId,
    title: assignment.title,
    dueDate: assignment.deadline,
    maxMarks: assignment.maxMarks ?? 20,
    description: assignment.description ?? '',
    submissions: Array.isArray(assignment.submissions) ? assignment.submissions.map(normalizeSubmission) : [],
  };
}

function App() {
  return (
    <BrowserRouter>
      <AppRouter />
    </BrowserRouter>
  );
}

function AppRouter() {
  const [currentUser, setCurrentUser] = useStoredState(STORAGE_KEYS.currentUser, null);
  const [users, setUsers] = useState([]);
  const [courses, setCourses] = useState(initialCourses);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [adminSettings, setAdminSettings] = useState(initialAdminSettings);

  useEffect(() => {
    if (!currentUser?.token) {
      setUsers([]);
      return;
    }

    apiRequest('/api/users', { token: currentUser.token })
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.token) {
      setCourses([]);
      return;
    }

    apiRequest('/api/courses', { token: currentUser.token })
      .then((data) => setCourses(Array.isArray(data) ? data : []))
      .catch(() => setCourses([]));
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser?.token) {
      setAssignments([]);
      return;
    }

    apiRequest('/api/assignments', { token: currentUser.token })
      .then((data) => setAssignments(Array.isArray(data) ? data.map(normalizeAssignment) : []))
      .catch(() => setAssignments([]));
  }, [currentUser]);

  const authValue = useMemo(() => ({ currentUser, setCurrentUser, users, setUsers }), [currentUser, users]);
  const dataValue = useMemo(
    () => ({ users, setUsers, courses, setCourses, assignments, setAssignments, adminSettings, setAdminSettings }),
    [users, courses, assignments, adminSettings]
  );

  return (
    <AuthContext.Provider value={authValue}>
      <DataContext.Provider value={dataValue}>
        <Routes>
          <Route path="/" element={<RootEntry />} />
          <Route path="/login" element={<RootEntry />} />

          <Route path="/student" element={<ProtectedRoute roles={['student']}><RoleLayout role="student" /></ProtectedRoute>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<StudentHome />} />
            <Route path="courses" element={<StudentCourses />} />
            <Route path="assignments" element={<StudentAssignments />} />
            <Route path="feedback" element={<StudentFeedback />} />
          </Route>

          <Route path="/teacher" element={<ProtectedRoute roles={['teacher']}><RoleLayout role="teacher" /></ProtectedRoute>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<TeacherHome />} />
            <Route path="courses" element={<TeacherCourses />} />
            <Route path="assignments" element={<TeacherAssignments />} />
            <Route path="grading" element={<TeacherAssignments />} />
          </Route>

          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><RoleLayout role="admin" /></ProtectedRoute>}>
            <Route index element={<Navigate to="home" replace />} />
            <Route path="home" element={<AdminHome />} />
            <Route path="courses" element={<AdminCourses />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="control" element={<AdminControlPanel />} />
          </Route>

          <Route path="*" element={<FallbackRedirect />} />
        </Routes>
      </DataContext.Provider>
    </AuthContext.Provider>
  );
}

function RootEntry() {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to={USER_ROLE_HOME[currentUser.role]} replace /> : <LoginPage />;
}

function FallbackRedirect() {
  const { currentUser } = useAuth();
  return currentUser ? <Navigate to={USER_ROLE_HOME[currentUser.role]} replace /> : <Navigate to="/" replace />;
}

function ProtectedRoute({ roles, children }) {
  const { currentUser } = useAuth();
  if (!currentUser) return <Navigate to="/" replace />;
  if (roles && !roles.includes(currentUser.role)) return <Navigate to={USER_ROLE_HOME[currentUser.role]} replace />;
  return children;
}

function RoleLayout({ role }) {
  const { currentUser, setCurrentUser } = useAuth();
  const navigate = useNavigate();

  const navItems =
    role === 'student'
      ? [
          ['/student/home', 'Home'],
          ['/student/courses', 'Courses'],
          ['/student/assignments', 'Assignments'],
          ['/student/feedback', 'Grades / Feedback'],
        ]
      : role === 'teacher'
        ? [
            ['/teacher/home', 'Home'],
            ['/teacher/courses', 'Courses'],
            ['/teacher/assignments', 'Assignments'],
            ['/teacher/grading', 'Grading Queue'],
          ]
        : [
            ['/admin/home', 'Home'],
            ['/admin/courses', 'Courses'],
            ['/admin/users', 'User Management'],
            ['/admin/control', 'Control Panel'],
          ];

  return (
    <div className="h-screen overflow-hidden bg-slate-50 text-slate-900">
      <div className="flex h-full">
        <aside className="flex h-full w-72 shrink-0 flex-col overflow-y-auto border-r border-slate-200 bg-white px-4 py-5 shadow-sm">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-400 text-lg font-bold text-white">AG</div>
            <div>
              <div className="text-sm font-semibold tracking-wide">AuroraGrade</div>
              <div className="text-xs text-slate-500">{USER_ROLE_LABELS[role]} dashboard</div>
            </div>
          </div>

          <nav className="space-y-1">
            {navItems.map(([to, label]) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center rounded-xl px-3 py-2.5 text-sm font-medium transition ${isActive ? 'bg-blue-100 text-blue-700' : 'text-slate-600 hover:bg-blue-50 hover:text-slate-900'}`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="mt-6 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-xs uppercase tracking-[0.2em] text-slate-400">Signed in as</div>
            <div className="mt-2 text-sm font-semibold">{currentUser?.name}</div>
            <div className="text-sm text-slate-500">{currentUser?.email}</div>
            <div className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{USER_ROLE_LABELS[currentUser?.role || role]}</div>
          </div>

          <button
            type="button"
            className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-blue-50 hover:text-slate-900"
            onClick={() => {
              setCurrentUser(null);
              navigate('/');
            }}
          >
            Log out
          </button>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex min-h-full w-full max-w-[1600px] flex-col gap-6 px-6 py-6 lg:px-8">
            <div className="rounded-3xl bg-white px-6 py-5 shadow-md ring-1 ring-slate-200">
              <div className="text-xs uppercase tracking-[0.28em] text-slate-400">Dashboard</div>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900">
                {role === 'student' ? 'Student learning hub' : role === 'teacher' ? 'Teacher workspace' : 'Admin control center'}
              </h1>
            </div>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function LoginPage() {
  const { currentUser, setCurrentUser, setUsers } = useAuth();
  const navigate = useNavigate();
  const [mode, setMode] = useState('login');
  const [selectedRole, setSelectedRole] = useState('student');
  const [error, setError] = useState('');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [registerForm, setRegisterForm] = useState({ name: '', email: '', password: '', role: 'student' });

  useEffect(() => {
    if (currentUser) navigate(USER_ROLE_HOME[currentUser.role], { replace: true });
  }, [currentUser, navigate]);

  async function handleLogin(event) {
    event.preventDefault();
    setError('');
    try {
      const response = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: {
          email: authForm.email.trim().toLowerCase(),
          password: authForm.password,
          role: selectedRole,
        },
      });
      const nextUser = { ...response.user, token: response.token };
      setCurrentUser(nextUser);
      setUsers((prev) => {
        if (prev.some((item) => item.id === nextUser.id)) return prev;
        return [...prev, nextUser];
      });
      navigate(USER_ROLE_HOME[nextUser.role], { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed.');
    }
  }

  async function handleRegister(event) {
    event.preventDefault();
    if (!registerForm.name.trim() || !registerForm.email.trim() || !registerForm.password.trim()) {
      setError('Enter a name, email, and password.');
      return;
    }
    setError('');
    try {
      const response = await apiRequest('/api/auth/register', {
        method: 'POST',
        body: {
          name: registerForm.name.trim(),
          email: registerForm.email.trim().toLowerCase(),
          password: registerForm.password,
          role: registerForm.role,
        },
      });
      const nextUser = { ...response.user, token: response.token };
      setCurrentUser(nextUser);
      setUsers((prev) => {
        if (prev.some((item) => item.id === nextUser.id)) return prev;
        return [...prev, nextUser];
      });
      navigate(USER_ROLE_HOME[nextUser.role], { replace: true });
    } catch (err) {
      setError(err.message || 'Registration failed.');
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe,_transparent_35%),radial-gradient(circle_at_bottom_right,_#e0f2fe,_transparent_30%),linear-gradient(180deg,_#f8fafc,_#eef2ff)] px-4 py-8 text-slate-900">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-8 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="space-y-6 rounded-[2rem] border border-white/60 bg-white/80 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] backdrop-blur">
          <div className="inline-flex items-center gap-3 rounded-full bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 ring-1 ring-blue-100">AuroraGrade role-based access control</div>
          <div>
            <h1 className="text-4xl font-semibold tracking-tight text-slate-900 md:text-5xl">One portal. Three roles. Clear access boundaries.</h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
              Sign in as an Admin, Teacher, or Student. The router blocks mismatched dashboard paths, the sidebar changes by role, and the teacher grading flow previews files in-browser.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[
              ['Student', 'Deadlines, submissions, and feedback'],
              ['Teacher', 'Course management and grading mode'],
              ['Admin', 'Users, system health, and global control'],
            ].map(([title, text]) => (
              <div key={title} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">{title}</div>
                <div className="mt-1 text-sm leading-6 text-slate-600">{text}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_20px_50px_rgba(15,23,42,0.1)]">
          <div className="flex gap-2 rounded-2xl bg-slate-100 p-1">
            {[
              ['login', 'Sign in'],
              ['register', 'Create account'],
            ].map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition ${mode === tabKey ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
                onClick={() => {
                  setMode(tabKey);
                  setError('');
                }}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-6">
            <div className="text-sm uppercase tracking-[0.2em] text-slate-400">Role selection</div>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {['admin', 'teacher', 'student'].map((role) => (
                <button
                  key={role}
                  type="button"
                  className={`rounded-2xl border px-4 py-3 text-left transition ${selectedRole === role ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
                  onClick={() => setSelectedRole(role)}
                >
                  <div className="text-sm font-semibold">{USER_ROLE_LABELS[role]}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {role === 'admin' ? 'System-wide control' : role === 'teacher' ? 'Course and grading tools' : 'Assignment and feedback access'}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {mode === 'login' ? (
            <form className="mt-6 space-y-4" onSubmit={handleLogin}>
              <Field label="Email" value={authForm.email} onChange={(e) => setAuthForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="name@school.edu" />
              <Field label="Password" type="password" value={authForm.password} onChange={(e) => setAuthForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Enter your password" />
              {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              <button type="submit" className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">Sign in</button>
            </form>
          ) : (
            <form className="mt-6 space-y-4" onSubmit={handleRegister}>
              <Field label="Full name" value={registerForm.name} onChange={(e) => setRegisterForm((prev) => ({ ...prev, name: e.target.value }))} placeholder="Jordan Lee" />
              <Field label="Email" value={registerForm.email} onChange={(e) => setRegisterForm((prev) => ({ ...prev, email: e.target.value }))} placeholder="name@school.edu" />
              <Field label="Password" type="password" value={registerForm.password} onChange={(e) => setRegisterForm((prev) => ({ ...prev, password: e.target.value }))} placeholder="Create a password" />
              <label className="block text-sm font-medium text-slate-600">
                Account role
                <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400" value={registerForm.role} onChange={(e) => setRegisterForm((prev) => ({ ...prev, role: e.target.value }))}>
                  <option value="student">Student</option>
                  <option value="teacher">Teacher</option>
                  <option value="admin">Admin</option>
                </select>
              </label>
              {error && <div className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>}
              <button type="submit" className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-500">Create account</button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}

function Field({ label, type = 'text', value, onChange, placeholder }) {
  return (
    <label className="block text-sm font-medium text-slate-600">
      {label}
      <input type={type} value={value} onChange={onChange} placeholder={placeholder} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-400" />
    </label>
  );
}

function SectionCard({ title, subtitle, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-5 shadow-md ring-1 ring-slate-200 ${className}`}>
      <div className="mb-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {children}
    </section>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
      {hint && <div className="mt-1 text-sm text-slate-500">{hint}</div>}
    </div>
  );
}

function StudentHome() {
  const { currentUser } = useAuth();
  const { courses, assignments } = useData();
  const studentName = currentUser?.name || '';
  const upcoming = assignments
    .filter(assignment => !assignment.submissions.some(sub => sub.studentName === studentName))
    .slice()
    .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
    .slice(0, 4);
  const graded = assignments.reduce((count, assignment) => count + assignment.submissions.filter((submission) => typeof submission.grade === 'number').length, 0);
  const mySubmissions = assignments.flatMap((assignment) => assignment.submissions.filter((submission) => submission.studentName === studentName).map((submission) => ({ assignment, submission })));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <StatCard label="Active courses" value={courses.length} hint="Enrolled this term" />
      <StatCard label="Upcoming deadlines" value={upcoming.length} hint="Assignments still open" />
      <StatCard label="Grades posted" value={graded} hint="Feedback ready for review" />

      <SectionCard title="Upcoming Deadlines" subtitle="Track the next assignments that need attention." className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {upcoming.map((assignment) => {
            const dueIn = daysUntil(assignment.dueDate);
            return (
              <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-slate-900">{assignment.title}</div>
                    <div className="mt-1 text-sm text-slate-500">{assignment.description}</div>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                    {dueIn === 0 ? 'Due today' : dueIn < 0 ? `${Math.abs(dueIn)} days late` : `${dueIn} days left`}
                  </span>
                </div>
                <div className="mt-3 text-sm text-slate-600">Due {formatDate(assignment.dueDate)} · {assignment.maxMarks} marks</div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="My Submissions" subtitle="Your latest uploaded files and their status.">
        <div className="space-y-3">
          {mySubmissions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No submissions yet.</div>
          ) : (
            mySubmissions.map(({ assignment, submission }) => (
              <div key={submission.id} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{assignment.title}</div>
                    <div className="text-sm text-slate-500">{submission.fileName}</div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">
                    {typeof submission.grade === 'number' ? `Graded · ${submission.grade}/${assignment.maxMarks}` : 'Pending'}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </SectionCard>

      <SectionCard title="Grades / Feedback" subtitle="Open feedback messages from teachers.">
        <FeedbackSummary />
      </SectionCard>
    </div>
  );
}

function StudentCourses() {
  const { courses, assignments } = useData();
  return (
    <SectionCard title="Courses" subtitle="Switch between class views and keep track of assignment volume.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">{course.code}</div>
            <div className="mt-1 text-sm text-slate-600">{course.name}</div>
            <div className="mt-3 text-sm text-slate-500">{course.teacher}</div>
            <div className="mt-4 text-xs text-slate-500">{courseLabel(course, assignments)}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function StudentAssignments() {
  const { currentUser } = useAuth();
  const { courses, assignments, setAssignments } = useData();
  const [submissionTarget, setSubmissionTarget] = useState(null);
  const [feedbackTarget, setFeedbackTarget] = useState(null);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {assignments.map((assignment) => {
        const course = courses.find((item) => item.id === assignment.courseId);
        const mySubmission = assignment.submissions.find((submission) => submission.studentName === currentUser?.name);

        return (
          <SectionCard key={assignment.id} title={assignment.title} subtitle={`${course?.code || 'Course'} · Due ${formatDate(assignment.dueDate)} · ${assignment.maxMarks} marks`}>
            <p className="text-sm leading-6 text-slate-600">{assignment.description}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500" onClick={() => setSubmissionTarget(assignment)}>Submit Link</button>
              <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50" onClick={() => setFeedbackTarget(assignment)}>View Feedback</button>
            </div>

            {mySubmission && (
              <div className="mt-4 rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
                <div className="text-sm font-semibold text-slate-900">Current submission</div>
                <div className="mt-1 text-sm text-blue-600 truncate">
                  <a href={mySubmission.fileUrl} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    {mySubmission.fileUrl}
                  </a>
                </div>
                <div className="mt-2 text-sm text-slate-500">{typeof mySubmission.grade === 'number' ? `Grade: ${mySubmission.grade}` : 'Waiting for review'}</div>
              </div>
            )}

            {submissionTarget?.id === assignment.id && (
              <LinkSubmissionModal
                assignment={assignment}
                onClose={() => setSubmissionTarget(null)}
                onSave={async ({ submissionLink }) => {
                  const savedSubmission = await apiRequest(`/api/submissions/assignment/${assignment.id}/link?submittedBy=${encodeURIComponent(currentUser?.name || 'Student')}`, {
                    method: 'POST',
                    token: currentUser?.token,
                    body: { submissionLink },
                  });

                  const normalized = normalizeSubmission(savedSubmission);
                  setAssignments((prev) => prev.map((item) => {
                    if (item.id !== assignment.id) return item;
                    const remaining = item.submissions.filter((submission) => submission.studentName !== normalized.studentName);
                    return { ...item, submissions: [...remaining, normalized] };
                  }));
                  setSubmissionTarget(null);
                }}
              />
            )}

            {feedbackTarget?.id === assignment.id && (
              <FeedbackModal title={assignment.title} submission={mySubmission} onClose={() => setFeedbackTarget(null)} />
            )}
          </SectionCard>
        );
      })}
    </div>
  );
}

function StudentFeedback() {
  return <FeedbackSummary />;
}

function FeedbackSummary() {
  const { currentUser } = useAuth();
  const { assignments } = useData();
  const rows = assignments.flatMap((assignment) => assignment.submissions.filter((submission) => submission.studentName === currentUser?.name).map((submission) => ({ assignment, submission })));

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 text-sm text-slate-500">Feedback will appear here once a teacher reviews a submission.</div>
      ) : (
        rows.map(({ assignment, submission }) => (
          <div key={submission.id} className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900">{assignment.title}</div>
                <div className="text-sm text-slate-500">{submission.fileName}</div>
              </div>
              <div className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">{typeof submission.grade === 'number' ? `${submission.grade}/${assignment.maxMarks}` : 'Pending'}</div>
            </div>
            <div className="mt-3 text-sm text-slate-600">{submission.feedback || 'No feedback yet.'}</div>
          </div>
        ))
      )}
    </div>
  );
}

function TeacherHome() {
  const { assignments, courses } = useData();
  const navigate = useNavigate();
  const queue = assignments.flatMap((assignment) => assignment.submissions.filter((submission) => typeof submission.grade !== 'number').map((submission) => ({ assignment, submission })));

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <StatCard label="Active courses" value={courses.length} hint="Classrooms ready to teach" />
      <StatCard label="Assignments live" value={assignments.length} hint="Published and visible" />
      <StatCard label="Grading queue" value={queue.length} hint="Waiting for review" />

      <SectionCard title="Active Courses" subtitle="Courses you can jump into immediately.">
        <div className="space-y-3">
          {courses.map((course) => (
            <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-semibold text-slate-900">{course.code}</div>
              <div className="text-sm text-slate-600">{course.name}</div>
              <div className="mt-2 text-xs text-slate-500">{course.term}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Grading Queue" subtitle="Items waiting for review and feedback." className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {queue.map(({ assignment, submission }) => (
            <div key={submission.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-slate-900">{assignment.title}</div>
                  <div className="text-sm text-slate-500">{submission.studentName}</div>
                </div>
                <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700">Needs review</span>
              </div>
              <div className="mt-3 text-sm text-slate-600">{submission.fileName}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Create Assignment" subtitle="Use the slide-over drawer to keep the dashboard clean.">
        <TeacherDraftDrawerButton onOpen={() => navigate('/teacher/assignments')} />
      </SectionCard>
    </div>
  );
}

function TeacherCourses() {
  const { courses } = useData();
  return (
    <SectionCard title="Courses" subtitle="Course cards stay evenly aligned inside a responsive grid.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">{course.code}</div>
            <div className="text-sm text-slate-600">{course.name}</div>
            <div className="mt-3 text-sm text-slate-500">{course.term}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function TeacherDraftDrawerButton({ onOpen }) {
  return (
    <button
      type="button"
      className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800"
      onClick={onOpen}
    >
      Open assignments workspace
    </button>
  );
}

function TeacherAssignments() {
  const { currentUser } = useAuth();
  const { courses, setCourses, assignments, setAssignments } = useData();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gradingTarget, setGradingTarget] = useState(null);
  const [courseDraft, setCourseDraft] = useState({ code: '', name: '', term: 'Spring 2026', teacher: '' });
  const [courseError, setCourseError] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentDraft, setAssignmentDraft] = useState({ courseId: courses[0]?.id || '', title: '', dueDate: '', maxMarks: 20, description: '' });

  useEffect(() => {
    if (!currentUser?.name) return;
    setCourseDraft((prev) => (prev.teacher ? prev : { ...prev, teacher: currentUser.name }));
  }, [currentUser]);

  useEffect(() => {
    if (!assignmentDraft.courseId && courses[0]?.id) {
      setAssignmentDraft((prev) => ({ ...prev, courseId: courses[0].id }));
    }
  }, [assignmentDraft.courseId, courses]);

  async function createCourse(event) {
    event.preventDefault();
    setCourseError('');
    if (!courseDraft.code.trim() || !courseDraft.name.trim() || !courseDraft.teacher.trim()) return;

    try {
      const created = await apiRequest('/api/courses', {
        method: 'POST',
        token: currentUser?.token,
        body: {
          code: courseDraft.code.trim(),
          name: courseDraft.name.trim(),
          term: courseDraft.term.trim() || 'Spring 2026',
          teacher: courseDraft.teacher.trim(),
        },
      });

      setCourses((prev) => [...prev, created]);
      setAssignmentDraft((prev) => ({ ...prev, courseId: created.id }));
      setCourseDraft({ code: '', name: '', term: 'Spring 2026', teacher: currentUser?.name || '' });
    } catch (error) {
      setCourseError(error?.message || 'Unable to create course');
    }
  }

  async function createAssignment(event) {
    event.preventDefault();
    setAssignmentError('');
    if (!assignmentDraft.title.trim()) return;
    if (!assignmentDraft.courseId) {
      setAssignmentError('Select a course before publishing the assignment.');
      return;
    }

    const normalizedDeadline = assignmentDraft.dueDate
      ? `${assignmentDraft.dueDate}T23:59:00`
      : new Date().toISOString().slice(0, 19);

    try {
      const created = await apiRequest('/api/assignments', {
        method: 'POST',
        token: currentUser?.token,
        body: {
          courseId: Number(assignmentDraft.courseId),
          title: assignmentDraft.title.trim(),
          description: assignmentDraft.description.trim(),
          deadline: normalizedDeadline,
          maxMarks: Number(assignmentDraft.maxMarks) || 20,
          uploadedBy: currentUser?.name || 'teacher',
        },
      });

      setAssignments((prev) => [...prev, normalizeAssignment(created)]);
      setAssignmentDraft((prev) => ({ ...prev, title: '', dueDate: '', maxMarks: 20, description: '' }));
      setDrawerOpen(false);
    } catch (error) {
      setAssignmentError(error?.message || 'Unable to publish assignment right now.');
    }
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <SectionCard title="Assignments" subtitle="Publish actions and grading inputs are kept here." className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {assignments.map((assignment) => {
            const course = courses.find((item) => item.id === assignment.courseId);
            const pending = assignment.submissions.filter((submission) => typeof submission.grade !== 'number').length;
            return (
              <div key={assignment.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-slate-900">{assignment.title}</div>
                    <div className="text-sm text-slate-500">{course?.code || 'Course'} · Due {formatDate(assignment.dueDate)}</div>
                  </div>
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{pending} pending</span>
                </div>
                <div className="mt-3 text-sm text-slate-600">{assignment.description}</div>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button type="button" className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500" onClick={() => setDrawerOpen(true)}>Publish Assignment</button>
                  <button
                    type="button"
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-blue-50"
                    onClick={() => {
                      const firstSubmission = assignment.submissions[0];
                      if (!firstSubmission) return;
                      setGradingTarget({ assignmentId: assignment.id, submissionId: firstSubmission.id });
                    }}
                  >
                    Review Submissions
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard title="Grading Queue" subtitle="Teacher-only grading inputs appear here." className="lg:col-span-2">
        <div className="space-y-3">
          {assignments.flatMap((assignment) => assignment.submissions.filter((submission) => typeof submission.grade !== 'number').map((submission) => ({ assignment, submission }))).map(({ assignment, submission }) => (
            <div key={submission.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">{assignment.title}</div>
                  <div className="text-sm text-slate-500">{submission.studentName} · {submission.fileName}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <input className="w-28 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400" type="number" placeholder="Grade" />
                  <button type="button" className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" onClick={() => setGradingTarget({ assignmentId: assignment.id, submissionId: submission.id })}>Grade</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Create Course" subtitle="Course creation lives in the drawer too." className="lg:col-span-2">
        <button type="button" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800" onClick={() => setDrawerOpen(true)}>Open course and assignment drawer</button>
      </SectionCard>

      {drawerOpen && (
        <TeacherDrawer
          onClose={() => setDrawerOpen(false)}
          courseDraft={courseDraft}
          setCourseDraft={setCourseDraft}
          courseError={courseError}
          assignmentError={assignmentError}
          assignmentDraft={assignmentDraft}
          setAssignmentDraft={setAssignmentDraft}
          courses={courses}
          createCourse={createCourse}
          createAssignment={createAssignment}
        />
      )}

      {gradingTarget && (
        <GradingModal
          assignment={assignments.find((assignment) => assignment.id === gradingTarget.assignmentId)}
          submissionId={gradingTarget.submissionId}
          onClose={() => setGradingTarget(null)}
          onSave={async ({ submissionId, grade, feedback }) => {
            const updated = await apiRequest(`/api/submissions/${submissionId}/grade`, {
              method: 'PUT',
              token: currentUser?.token,
              body: { grade, feedback },
            });
            const updatedSubmission = normalizeSubmission(updated);

            setAssignments((prev) =>
              prev.map((assignment) =>
                assignment.id !== gradingTarget.assignmentId
                  ? assignment
                  : {
                      ...assignment,
                      submissions: assignment.submissions.map((submission) =>
                        submission.id === updatedSubmission.id ? updatedSubmission : submission
                      ),
                    }
              )
            );
          }}
        />
      )}
    </div>
  );
}

function TeacherDrawer({ onClose, courseDraft, setCourseDraft, courseError, assignmentError, assignmentDraft, setAssignmentDraft, courses, createCourse, createAssignment }) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm">
      <div className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-y-auto bg-white shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Manage courses and assignments</div>
            <div className="text-sm text-slate-500">Forms stay in a drawer so the dashboard remains uncluttered.</div>
          </div>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={onClose}>Close</button>
        </div>

        <div className="grid gap-4 p-6">
          <section className="max-h-[32rem] overflow-y-auto rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <div className="text-base font-semibold text-slate-900">Create Course</div>
            <form className="mt-4 space-y-4" onSubmit={createCourse}>
              <Field label="Course code" value={courseDraft.code} onChange={(event) => setCourseDraft((prev) => ({ ...prev, code: event.target.value }))} placeholder="CS450" />
              <Field label="Course name" value={courseDraft.name} onChange={(event) => setCourseDraft((prev) => ({ ...prev, name: event.target.value }))} placeholder="Machine Learning" />
              <Field label="Term" value={courseDraft.term} onChange={(event) => setCourseDraft((prev) => ({ ...prev, term: event.target.value }))} placeholder="Spring 2026" />
              <Field label="Teacher name" value={courseDraft.teacher} onChange={(event) => setCourseDraft((prev) => ({ ...prev, teacher: event.target.value }))} placeholder="Taylor Teacher" />
              {courseError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{courseError}</div> : null}
              <button className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500" type="submit">Add Course</button>
            </form>
            <div className="mt-4 space-y-2">
              {courses.map((course) => <div key={course.id} className="rounded-xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">{course.code} · {course.name}</div>)}
            </div>
          </section>

          <section className="max-h-[32rem] overflow-y-auto rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
            <div className="text-base font-semibold text-slate-900">Create Assignment</div>
            <form className="mt-4 space-y-4" onSubmit={createAssignment}>
              <label className="block text-sm font-medium text-slate-600">
                Course
                <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400" value={assignmentDraft.courseId} onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, courseId: event.target.value }))}>
                  {courses.map((course) => <option key={course.id} value={course.id}>{course.code} · {course.name}</option>)}
                </select>
              </label>
              <Field label="Title" value={assignmentDraft.title} onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, title: event.target.value }))} placeholder="Project 1: Portfolio" />
              <Field label="Due date" type="date" value={assignmentDraft.dueDate} onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, dueDate: event.target.value }))} />
              <Field label="Max marks" type="number" value={assignmentDraft.maxMarks} onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, maxMarks: event.target.value }))} />
              <label className="block text-sm font-medium text-slate-600">
                Description
                <textarea className="mt-2 min-h-28 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400" value={assignmentDraft.description} onChange={(event) => setAssignmentDraft((prev) => ({ ...prev, description: event.target.value }))} placeholder="Outline deliverables and grading expectations." />
              </label>
              {assignmentError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{assignmentError}</div> : null}
              <button className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" type="submit">Publish Assignment</button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}

function GradingModal({ assignment, submissionId, onClose, onSave }) {
  const { courses } = useData();
  if (!assignment) return null;
  const course = courses.find((item) => item.id === assignment.courseId);
  const submission = assignment.submissions.find((item) => item.id === submissionId) || assignment.submissions[0] || { id: 'empty', fileUrl: '', fileName: 'No submission available', mimeType: '', grade: null, feedback: '' };
  const [grade, setGrade] = useState(submission.grade ?? '');
  const [feedback, setFeedback] = useState(submission.feedback ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const previewEnabled = canPreviewInline(submission);
  const previewUrl = getPreviewUrl(submission);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/60 p-4 backdrop-blur-sm">
      <div className="mx-auto flex h-full max-w-7xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Grading Mode</div>
            <div className="text-sm text-slate-500">{assignment.title} {course ? `· ${course.code}` : ''}</div>
          </div>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={onClose}>Close</button>
        </div>

        <div className="grid flex-1 grid-cols-1 gap-0 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border-b border-slate-200 bg-slate-50 lg:border-b-0 lg:border-r">
            <div className="flex h-full min-h-[26rem] flex-col items-center justify-center gap-4 p-6 text-center">
              <div className="text-base font-semibold text-slate-900">Student Solution Link</div>
              <div className="max-w-md text-sm text-slate-600">
                Click the button below to open the student's submitted solution in a new tab.
              </div>
              {submission?.fileUrl ? (
                <a
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
                  href={submission.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open Solution
                </a>
              ) : (
                <div className="text-sm text-slate-500">No submission available.</div>
              )}
              {submission?.fileUrl && (
                <div className="mt-4 max-w-md break-all rounded-xl bg-white px-4 py-3 text-xs text-slate-500 ring-1 ring-slate-200">
                  <div className="mb-1 font-medium text-slate-600">Submission Link:</div>
                  {submission.fileUrl}
                </div>
              )}
            </div>
          </div>

          <div className="overflow-y-auto p-6">
            <div className="rounded-2xl bg-slate-50 p-5 ring-1 ring-slate-200">
              <div className="text-base font-semibold text-slate-900">Grade and feedback</div>
              <div className="mt-4 space-y-4">
                <label className="block text-sm font-medium text-slate-600">
                  Grade
                  <input className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400" type="number" value={grade} onChange={(event) => setGrade(event.target.value)} />
                </label>
                <label className="block text-sm font-medium text-slate-600">
                  Feedback
                  <textarea className="mt-2 min-h-44 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400" value={feedback} onChange={(event) => setFeedback(event.target.value)} placeholder="Leave coaching notes, strengths, and next steps." />
                </label>
                <button
                  type="button"
                  disabled={isSaving}
                  className="w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={async () => {
                    setSaveError('');
                    setIsSaving(true);
                    try {
                      await onSave({ submissionId: submission.id, grade: grade === '' ? null : Number(grade), feedback });
                      onClose();
                    } catch (error) {
                      setSaveError(error?.message || 'Unable to save grade right now.');
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                >
                  {isSaving ? 'Saving...' : 'Save grade and feedback'}
                </button>
                {saveError ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{saveError}</div> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LinkSubmissionModal({ assignment, onClose, onSave }) {
  const [submissionLink, setSubmissionLink] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  async function submitLink() {
    if (!submissionLink.trim()) {
      setError('Please enter a valid link.');
      return;
    }

    // Basic URL validation
    try {
      new URL(submissionLink.trim());
    } catch {
      setError('Please enter a valid URL (e.g., https://example.com)');
      return;
    }

    setError('');
    setIsSaving(true);
    try {
      await onSave({ submissionLink: submissionLink.trim() });
    } catch (saveError) {
      setError(saveError?.message || 'Submission failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-xl rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Submit Solution Link</div>
            <div className="text-sm text-slate-500">{assignment.title}</div>
          </div>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={onClose}>Close</button>
        </div>

        <div className="mt-5 space-y-4">
          <label className="block text-sm font-medium text-slate-600">
            Solution Link
            <input
              type="url"
              placeholder="https://example.com/solution"
              className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400"
              value={submissionLink}
              onChange={(event) => {
                setSubmissionLink(event.target.value);
                setError('');
              }}
            />
            <div className="mt-1 text-xs text-slate-500">Paste the link to your solution (GitHub, Google Drive, CodePen, etc.)</div>
          </label>
          {error ? <div className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</div> : null}
          <div className="flex justify-end gap-3">
            <button type="button" className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={onClose}>Cancel</button>
            <button type="button" disabled={isSaving} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60" onClick={submitLink}>{isSaving ? 'Submitting...' : 'Submit Link'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeedbackModal({ title, submission, onClose }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-[2rem] bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-lg font-semibold text-slate-900">Feedback</div>
            <div className="text-sm text-slate-500">{title}</div>
          </div>
          <button type="button" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50" onClick={onClose}>Close</button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">Your Solution</div>
            <div className="mt-3">
              {submission?.fileUrl ? (
                <a href={submission.fileUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500">
                  Open Solution Link
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              ) : (
                <div className="text-sm text-slate-500">No submission available.</div>
              )}
            </div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">Teacher Feedback</div>
            <div className="mt-3 text-sm leading-6 text-slate-600">{submission?.feedback || 'No feedback available.'}</div>
            <div className="mt-4 rounded-xl bg-white px-4 py-3 text-sm text-slate-600 ring-1 ring-slate-200">Grade: {typeof submission?.grade === 'number' ? submission.grade : 'Pending'}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminHome() {
  const { users, setUsers, courses, assignments, adminSettings, setAdminSettings } = useData();
  const { currentUser } = useAuth();
  const teacherCount = users.filter((user) => user.role === 'teacher').length;
  const studentCount = users.filter((user) => user.role === 'student').length;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <StatCard label="Total users" value={users.length} hint={`${teacherCount} teachers and ${studentCount} students`} />
      <StatCard label="Courses" value={courses.length} hint="All classes on the platform" />
      <StatCard label="System health" value={adminSettings.maintenanceMode ? 'Maintenance' : 'Healthy'} hint={adminSettings.maintenanceMode ? 'Read-only mode enabled' : 'Normal operation'} />

      <SectionCard title="User Management" subtitle="Add or remove accounts from the platform." className="lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Email</th>
                <th className="px-4 py-3 text-left font-medium">Role</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {users.map((user) => (
                <tr key={user.id}>
                  <td className="px-4 py-3">{user.name}</td>
                  <td className="px-4 py-3 text-slate-500">{user.email}</td>
                  <td className="px-4 py-3 capitalize">{user.role}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                      onClick={async () => {
                        try {
                          await apiRequest(`/api/users/${user.id}`, { method: 'DELETE', token: currentUser?.token });
                          setUsers((prev) => prev.filter((item) => item.id !== user.id));
                        } catch {
                          // Keep UI responsive without breaking the page if deletion fails.
                        }
                      }}
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard title="System Health" subtitle="Quick control toggles for the website.">
        <div className="space-y-3">
          {[
            ['maintenanceMode', 'Maintenance mode'],
            ['announcementsEnabled', 'Announcements enabled'],
            ['autoArchive', 'Auto archive submissions'],
          ].map(([key, label]) => (
            <label key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <span>{label}</span>
              <input type="checkbox" checked={Boolean(adminSettings[key])} onChange={(event) => setAdminSettings((prev) => ({ ...prev, [key]: event.target.checked }))} />
            </label>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Add account" subtitle="Create a new user entry from the admin panel.">
        <AdminQuickAdd />
      </SectionCard>

      <SectionCard title="User Management" subtitle="Remove accounts or review access levels." className="lg:col-span-2">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="font-semibold text-slate-900">{user.name}</div>
              <div className="text-sm text-slate-500">{user.email}</div>
              <div className="mt-3 inline-flex rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700">{USER_ROLE_LABELS[user.role]}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Control Panel" subtitle="Site-wide settings and course visibility.">
        <div className="space-y-3">
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">Published courses</div>
            <div className="mt-2 text-sm text-slate-600">{courses.length} active courses across the platform.</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4 ring-1 ring-slate-200">
            <div className="text-sm font-semibold text-slate-900">Open assignments</div>
            <div className="mt-2 text-sm text-slate-600">{assignments.length} visible assignments.</div>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}

function AdminCourses() {
  const { courses, assignments } = useData();
  return (
    <SectionCard title="All courses" subtitle="A high-level list of courses across the platform.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {courses.map((course) => (
          <div key={course.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="font-semibold text-slate-900">{course.code}</div>
            <div className="text-sm text-slate-600">{course.name}</div>
            <div className="mt-2 text-sm text-slate-500">{course.term}</div>
            <div className="mt-3 text-xs text-slate-500">{courseLabel(course, assignments)}</div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function AdminUsers() {
  const { users, setUsers } = useData();
  const { currentUser } = useAuth();
  return (
    <SectionCard title="User Management" subtitle="Add or remove accounts from the platform.">
      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 bg-white">
            {users.map((user) => (
              <tr key={user.id}>
                <td className="px-4 py-3">{user.name}</td>
                <td className="px-4 py-3 text-slate-500">{user.email}</td>
                <td className="px-4 py-3 capitalize">{user.role}</td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
                    onClick={async () => {
                      try {
                        await apiRequest(`/api/users/${user.id}`, { method: 'DELETE', token: currentUser?.token });
                        setUsers((prev) => prev.filter((item) => item.id !== user.id));
                      } catch {
                        // Keep UI responsive without breaking the page if deletion fails.
                      }
                    }}
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </SectionCard>
  );
}

function AdminControlPanel() {
  const { adminSettings, setAdminSettings } = useData();
  return (
    <SectionCard title="Control Panel" subtitle="Manage the website settings and platform-wide tools.">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {[
          ['maintenanceMode', 'Maintenance mode', 'Take the site offline for updates.'],
          ['announcementsEnabled', 'Announcements', 'Broadcast alerts to all users.'],
          ['autoArchive', 'Auto archive', 'Archive completed work after grading.'],
        ].map(([key, label, text]) => (
          <label key={key} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="font-semibold text-slate-900">{label}</div>
                <div className="mt-1 text-sm text-slate-500">{text}</div>
              </div>
              <input type="checkbox" checked={Boolean(adminSettings[key])} onChange={(event) => setAdminSettings((prev) => ({ ...prev, [key]: event.target.checked }))} />
            </div>
          </label>
        ))}
      </div>
    </SectionCard>
  );
}

function AdminQuickAdd() {
  const { setUsers } = useData();
  const { currentUser } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'student' });

  return (
    <form
      className="space-y-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!form.name.trim() || !form.email.trim() || !form.password.trim()) return;
        try {
          const created = await apiRequest('/api/users', {
            method: 'POST',
            token: currentUser?.token,
            body: {
              name: form.name.trim(),
              email: form.email.trim().toLowerCase(),
              password: form.password,
              role: form.role,
            },
          });
          setUsers((prev) => [...prev, created]);
          setForm({ name: '', email: '', password: '', role: 'student' });
        } catch {
          // Keep UI responsive without breaking the page if adding fails.
        }
      }}
    >
      <Field label="Name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Alex Morgan" />
      <Field label="Email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} placeholder="alex@school.edu" />
      <Field label="Password" type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} placeholder="Temp password" />
      <label className="block text-sm font-medium text-slate-600">
        Role
        <select className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:border-blue-400" value={form.role} onChange={(event) => setForm((prev) => ({ ...prev, role: event.target.value }))}>
          <option value="student">Student</option>
          <option value="teacher">Teacher</option>
          <option value="admin">Admin</option>
        </select>
      </label>
      <button type="submit" className="rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800">Add account</button>
    </form>
  );
}

export default App;