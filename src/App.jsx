import React, { useMemo, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';

const MOCK_COURSES = [
  {
    id: 'c1',
    code: 'CS101',
    name: 'Introduction to Programming',
    term: 'Spring 2026',
    totalAssignments: 4,
  },
  {
    id: 'c2',
    code: 'CS204',
    name: 'Data Structures',
    term: 'Spring 2026',
    totalAssignments: 3,
  },
  {
    id: 'c3',
    code: 'CS310',
    name: 'Web Application Development',
    term: 'Spring 2026',
    totalAssignments: 5,
  },
];

const initialAssignments = [
  {
    id: 'a1',
    courseId: 'c1',
    title: 'Variables & Conditionals',
    description: 'Short coding exercises covering basic input/output, variables, and if/else.',
    dueDate: '2026-03-05',
    maxMarks: 20,
    submissions: [
      {
        id: 's1',
        studentName: 'You',
        submittedAt: '2026-02-21T19:10:00Z',
        fileLink: 'variables-conditionals.js',
        comments: 'All exercises implemented with test cases.',
        grade: 18,
        feedback: 'Solid work. Consider simplifying your boolean expressions for readability.',
      },
      {
        id: 's2',
        studentName: 'Alex Johnson',
        submittedAt: '2026-02-21T18:02:00Z',
        fileLink: 'alex-variables.js',
        comments: '',
        grade: 16,
        feedback: 'Good attempt. Please double-check edge cases around negative inputs.',
      },
    ],
  },
  {
    id: 'a2',
    courseId: 'c1',
    title: 'Loops & Arrays',
    description: 'Practice problems with for/while loops and basic array operations.',
    dueDate: '2026-03-12',
    maxMarks: 30,
    submissions: [],
  },
  {
    id: 'a3',
    courseId: 'c2',
    title: 'Linked List Implementation',
    description: 'Implement a singly linked list with insert, delete, and search.',
    dueDate: '2026-03-07',
    maxMarks: 30,
    submissions: [],
  },
];

const EMPTY_STUDENT_SUBMISSION_DRAFT = {
  assignmentId: null,
  fileName: '',
  fileUrl: '',
  comments: '',
};

function formatDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function daysUntil(iso) {
  if (!iso) return null;
  const oneDay = 1000 * 60 * 60 * 24;
  const today = new Date();
  const target = new Date(iso);
  const diff = Math.round((target.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / oneDay);
  return diff;
}

function AppInner() {
  const [role, setRole] = useState(null); // 'student' | 'teacher'
  const [selectedCourseId, setSelectedCourseId] = useState(MOCK_COURSES[0].id);
  const [courses, setCourses] = useState(MOCK_COURSES);
  const [assignments, setAssignments] = useState(initialAssignments);
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' | 'submissions'
  const [studentView, setStudentView] = useState('home'); // 'home' | 'courses' | 'submit' | 'help' | 'profile'
  const [teacherView, setTeacherView] = useState('home'); // 'home' | 'courses' | 'assignments' | 'help' | 'profile'
  const [auth, setAuth] = useState({
    email: '',
    password: '',
  });
  const [registration, setRegistration] = useState({
    email: '',
    password: '',
    role: 'student',
  });
  const [resetEmail, setResetEmail] = useState('');

  const [studentSubmissionDraft, setStudentSubmissionDraft] = useState(EMPTY_STUDENT_SUBMISSION_DRAFT);

  const [teacherAssignmentDraft, setTeacherAssignmentDraft] = useState({
    courseId: MOCK_COURSES[0].id,
    title: '',
    description: '',
    dueDate: '',
    maxMarks: 100,
  });

  const [gradingDraft, setGradingDraft] = useState({
    assignmentId: null,
    submissionId: null,
    grade: '',
    feedback: '',
  });

  const selectedCourse = useMemo(
    () => courses.find((c) => c.id === selectedCourseId),
    [courses, selectedCourseId]
  );

  const courseAssignments = useMemo(
    () => assignments.filter((a) => a.courseId === selectedCourseId),
    [assignments, selectedCourseId]
  );

  const studentStats = useMemo(() => {
    const all = assignments;
    const submitted = all.filter((a) => a.submissions.some((s) => s.studentName === 'You'));
    const graded = submitted.filter((a) =>
      a.submissions.some((s) => s.studentName === 'You' && typeof s.grade === 'number')
    );
    const completed = graded.length;

    const avgGrade =
      graded.reduce((sum, a) => {
        const sub = a.submissions.find((s) => s.studentName === 'You');
        return sum + (sub ? sub.grade : 0);
      }, 0) / (graded.length || 1);

    const upcoming = all
      .filter((a) => !a.submissions.some((s) => s.studentName === 'You'))
      .sort((a, b) => (a.dueDate || '').localeCompare(b.dueDate || ''))
      .slice(0, 2);

    return {
      total: all.length,
      submitted: submitted.length,
      completed,
      avgGrade: graded.length ? Math.round(avgGrade) : null,
      upcoming,
    };
  }, [assignments]);

  const teacherStats = useMemo(() => {
    const all = assignments;
    const totalSubmissions = all.reduce((sum, a) => sum + a.submissions.length, 0);
    const graded = all.reduce(
      (sum, a) =>
        sum +
        a.submissions.filter((s) => typeof s.grade === 'number' && !Number.isNaN(s.grade)).length,
      0
    );
    const pending = totalSubmissions - graded;

    const toGrade = all
      .flatMap((a) => a.submissions.map((s) => ({ assignment: a, submission: s })))
      .filter((pair) => typeof pair.submission.grade !== 'number' || Number.isNaN(pair.submission.grade))
      .slice(0, 2);

    return {
      assignments: all.length,
      totalSubmissions,
      graded,
      pending,
      toGrade,
    };
  }, [assignments]);

  function handleStudentSubmit(assignmentId) {
    if (!studentSubmissionDraft.fileName.trim()) return;

    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id !== assignmentId) return a;
        const existing = a.submissions.find((s) => s.studentName === 'You');
        const updatedSubmission = {
          id: existing ? existing.id : `s-${Date.now()}`,
          studentName: 'You',
          submittedAt: new Date().toISOString(),
          fileLink: studentSubmissionDraft.fileName.trim(),
          fileUrl: studentSubmissionDraft.fileUrl || '',
          comments: studentSubmissionDraft.comments.trim(),
          grade: existing ? existing.grade : null,
          feedback: existing ? existing.feedback : '',
        };
        return {
          ...a,
          submissions: existing
            ? a.submissions.map((s) => (s.studentName === 'You' ? updatedSubmission : s))
            : [...a.submissions, updatedSubmission],
        };
      })
    );

    setStudentSubmissionDraft(EMPTY_STUDENT_SUBMISSION_DRAFT);
  }

  function handleCreateAssignment() {
    if (!teacherAssignmentDraft.courseId || !teacherAssignmentDraft.title.trim()) return;
    const newAssignment = {
      id: `a-${Date.now()}`,
      courseId: teacherAssignmentDraft.courseId,
      title: teacherAssignmentDraft.title.trim(),
      description: teacherAssignmentDraft.description.trim(),
      dueDate: teacherAssignmentDraft.dueDate || null,
      maxMarks: Number(teacherAssignmentDraft.maxMarks) || 100,
      submissions: [],
    };
    setAssignments((prev) => [...prev, newAssignment]);
    setTeacherAssignmentDraft({
      courseId: teacherAssignmentDraft.courseId,
      title: '',
      description: '',
      dueDate: '',
      maxMarks: 100,
    });
    setSelectedCourseId(teacherAssignmentDraft.courseId);
    setActiveTab('assignments');
  }

  function handleGradeSubmit() {
    if (!gradingDraft.assignmentId || !gradingDraft.submissionId) return;
    const numericGrade = Number(gradingDraft.grade);
    if (Number.isNaN(numericGrade)) return;

    setAssignments((prev) =>
      prev.map((a) => {
        if (a.id !== gradingDraft.assignmentId) return a;
        return {
          ...a,
          submissions: a.submissions.map((s) =>
            s.id === gradingDraft.submissionId
              ? {
                  ...s,
                  grade: numericGrade,
                  feedback: gradingDraft.feedback.trim(),
                }
              : s
          ),
        };
      })
    );

    setGradingDraft({ assignmentId: null, submissionId: null, grade: '', feedback: '' });
  }

  const [newCourseDraft, setNewCourseDraft] = useState({
    code: '',
    name: '',
    term: 'Spring 2026',
    totalAssignments: 0,
  });

  const navigate = useNavigate();

  const headlineStats = role === 'student' ? studentStats : teacherStats;
  const canSubmitStudentAssignment =
    Boolean(studentSubmissionDraft.assignmentId) && Boolean(studentSubmissionDraft.fileName.trim());

  function handleLogin(nextRole) {
    if (!nextRole || !auth.email.trim() || !auth.password.trim()) return;
    setRole(nextRole);
    setActiveTab('assignments');
    setStudentView('home');
    setTeacherView('home');
    navigate(nextRole === 'student' ? '/student' : '/teacher');
  }

  function handleLogout() {
    setRole(null);
    navigate('/');
  }

  function handleCreateCourse() {
    if (!newCourseDraft.code.trim() || !newCourseDraft.name.trim()) return;
    const id = `c-${Date.now()}`;
    const newCourse = {
      id,
      code: newCourseDraft.code.trim(),
      name: newCourseDraft.name.trim(),
      term: newCourseDraft.term.trim() || 'Spring 2026',
      totalAssignments: Number(newCourseDraft.totalAssignments) || 0,
    };
    setCourses((prev) => [...prev, newCourse]);
    setNewCourseDraft({
      code: '',
      name: '',
      term: newCourseDraft.term,
      totalAssignments: 0,
    });
    setSelectedCourseId(id);
  }

  return (
    <Routes>
      <Route
        path="/"
        element={
          <div className="login-shell">
            <div className="login-card">
              <div className="login-main">
            <div className="brand" style={{ marginBottom: '0.75rem' }}>
              <div className="brand-logo">
                <div className="brand-logo-inner">AG</div>
              </div>
              <div className="brand-text">
                <div className="brand-title">AuroraGrade</div>
                <div className="brand-subtitle">Online assignment submission and grading</div>
              </div>
            </div>
            <div className="login-title">Sign in to continue</div>
            <div className="login-subtitle">
              Choose whether you’re accessing the portal as a student or a teacher. Each role has
              its own dashboard and tools.
            </div>

            <div className="login-role-grid">
              <button
                type="button"
                className={`login-role-card ${role === 'student' ? 'active' : ''}`}
                onClick={() => setRole('student')}
              >
                <div className="login-role-label">Student</div>
                <div className="login-role-chip">
                  Submit assignments, view grades, and track deadlines.
                </div>
              </button>
              <button
                type="button"
                className={`login-role-card ${role === 'teacher' ? 'active' : ''}`}
                onClick={() => setRole('teacher')}
              >
                <div className="login-role-label">Teacher</div>
                <div className="login-role-chip">
                  Create assignments, grade submissions, and leave feedback.
                </div>
              </button>
            </div>

            <div className="form-row">
              <label className="form-label">Email ID</label>
              <input
                className="form-input"
                type="email"
                placeholder="name@example.com"
                value={auth.email}
                onChange={(e) =>
                  setAuth((prev) => ({
                    ...prev,
                    email: e.target.value,
                  }))
                }
              />
            </div>
            <div className="form-row">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                placeholder="Enter your password"
                value={auth.password}
                onChange={(e) =>
                  setAuth((prev) => ({
                    ...prev,
                    password: e.target.value,
                  }))
                }
              />
              <div className="login-actions-row">
                <button
                  type="button"
                  className="link-button"
                  onClick={() => navigate('/forgot-password')}
                >
                  Forgot password?
                </button>
              </div>
            </div>

            <div className="login-footer">
              <button
                type="button"
                className="primary-button"
                disabled={!role || !auth.email.trim() || !auth.password.trim()}
                onClick={() => handleLogin(role)}
              >
                Login
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={() => navigate('/register')}
              >
                Register
              </button>
            </div>
          </div>

          <aside className="login-side">
            <div className="login-title">What you can do</div>
            <div className="login-metric">
              <strong>Students</strong> can quickly see which assignments are due, submit work,
              and read teacher remarks.
            </div>
            <div className="login-metric">
              <strong>Teachers</strong> can manage courses, publish assignments, and grade
              submissions with written feedback.
            </div>
            <div className="login-badge">
              <span className="login-badge-dot" />
              All data in this demo is stored in your browser only.
            </div>
            <ul className="login-side-list">
              <li>Course-aware dashboards for both roles</li>
              <li>Assignment deadlines and max marks per course</li>
              <li>Inline grading with feedback/remarks</li>
              <li>Submission history with grades for students</li>
            </ul>
          </aside>
        </div>
      </div>
        }
      />

      <Route
        path="/forgot-password"
        element={
          <div className="login-shell">
            <div className="login-card">
              <div className="login-main">
                <div className="brand" style={{ marginBottom: '0.75rem' }}>
                  <div className="brand-logo">
                    <div className="brand-logo-inner">AG</div>
                  </div>
                  <div className="brand-text">
                    <div className="brand-title">AuroraGrade</div>
                    <div className="brand-subtitle">Reset your password</div>
                  </div>
                </div>
                <div className="login-title">Forgot password</div>
                <div className="login-subtitle">
                  Enter your email ID to reset the password.
                </div>
                <div className="form-row">
                  <label className="form-label">Email ID</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="name@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                  />
                </div>
                <div className="login-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate('/')}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!resetEmail.trim()}
                  >
                    Reset password
                  </button>
                </div>
              </div>
              <aside className="login-side">
                <div className="login-title">Password recovery</div>
                <div className="login-metric">
                  In this demo, reset email sending is simulated only.
                </div>
              </aside>
            </div>
          </div>
        }
      />

      <Route
        path="/register"
        element={
          <div className="login-shell">
            <div className="login-card">
              <div className="login-main">
                <div className="brand" style={{ marginBottom: '0.75rem' }}>
                  <div className="brand-logo">
                    <div className="brand-logo-inner">AG</div>
                  </div>
                  <div className="brand-text">
                    <div className="brand-title">AuroraGrade</div>
                    <div className="brand-subtitle">Create your account</div>
                  </div>
                </div>
                <div className="login-title">Register</div>
                <div className="login-subtitle">
                  Register with your email ID and password.
                </div>
                <div className="form-row">
                  <label className="form-label">Role</label>
                  <select
                    className="form-select"
                    value={registration.role}
                    onChange={(e) =>
                      setRegistration((prev) => ({
                        ...prev,
                        role: e.target.value,
                      }))
                    }
                  >
                    <option value="student">Student</option>
                    <option value="teacher">Teacher</option>
                  </select>
                </div>
                <div className="form-row">
                  <label className="form-label">Email ID</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="name@example.com"
                    value={registration.email}
                    onChange={(e) =>
                      setRegistration((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="form-row">
                  <label className="form-label">Password</label>
                  <input
                    className="form-input"
                    type="password"
                    placeholder="Create a password"
                    value={registration.password}
                    onChange={(e) =>
                      setRegistration((prev) => ({
                        ...prev,
                        password: e.target.value,
                      }))
                    }
                  />
                </div>
                <div className="login-footer">
                  <button
                    type="button"
                    className="secondary-button"
                    onClick={() => navigate('/')}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    className="primary-button"
                    disabled={!registration.email.trim() || !registration.password.trim()}
                    onClick={() => {
                      setRole(registration.role);
                      setAuth({
                        email: registration.email.trim(),
                        password: registration.password,
                      });
                      navigate('/');
                    }}
                  >
                    Register account
                  </button>
                </div>
              </div>
              <aside className="login-side">
                <div className="login-title">Quick setup</div>
                <div className="login-metric">
                  After registration, return to login and click Login.
                </div>
              </aside>
            </div>
          </div>
        }
      />

      <Route
        path="/student"
        element={
          role === 'student' ? (
            <div className="app-shell">
              <header className="app-header">
                <div className="app-header-inner">
                  <div className="brand">
                    <div className="brand-logo">
                      <div className="brand-logo-inner">AG</div>
                    </div>
                    <div className="brand-text">
                      <div className="brand-title">AuroraGrade</div>
                      <div className="brand-subtitle">
                        Student dashboard • assignments, grades, and feedback
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              </header>

              <main className="app-main">
                <div className="app-layout-with-sidebar">
                  <aside className="side-nav">
                    <div className="side-nav-header">
                      <div className="side-nav-title">Student</div>
                      <div className="side-nav-subtitle">Learning workspace</div>
                    </div>
                    <button
                      type="button"
                      className={`side-nav-item ${studentView === 'home' ? 'active' : ''}`}
                      onClick={() => {
                        setStudentView('home');
                        setActiveTab('assignments');
                      }}
                    >
                      Home
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${studentView === 'courses' ? 'active' : ''}`}
                      onClick={() => setStudentView('courses')}
                    >
                      Courses
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${studentView === 'submit' ? 'active' : ''}`}
                      onClick={() => setStudentView('submit')}
                    >
                      Submit Assignment
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${studentView === 'help' ? 'active' : ''}`}
                      onClick={() => setStudentView('help')}
                    >
                      Help
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${studentView === 'profile' ? 'active' : ''}`}
                      onClick={() => setStudentView('profile')}
                    >
                      Profile
                    </button>
                  </aside>
                  <div className="app-main-inner">
                    {studentView === 'home' && (
                      <>
                  <section className="summary-column">
                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Your assignment story</div>
                            <div className="panel-title-sub">
                              See deadlines, submissions, and feedback in one place.
                            </div>
                          </div>
                          <div className="panel-badge">
                            <span className="badge-dot" /> Student mode
                          </div>
                        </div>

                        <div className="metrics-row">
                      <div className="metric-pill">
                        <span className="metric-label">Completed</span>
                        <span className="metric-value">
                          {headlineStats.completed}/{headlineStats.total}
                        </span>
                        <span className="metric-footnote">with grades posted</span>
                      </div>
                      <div className="metric-pill">
                        <span className="metric-label">Average grade</span>
                        <span className="metric-value">
                          {headlineStats.avgGrade != null
                            ? `${headlineStats.avgGrade}%`
                            : 'Awaiting grades'}
                        </span>
                        <span className="metric-footnote">across graded work</span>
                      </div>
                      <div className="metric-pill">
                        <span className="metric-label">Upcoming</span>
                        <span className="metric-value">
                          {headlineStats.upcoming.length
                            ? `${headlineStats.upcoming.length} due`
                            : 'All caught up'}
                        </span>
                        <span className="metric-footnote">
                          {headlineStats.upcoming[0]
                            ? `Next: ${formatDate(headlineStats.upcoming[0].dueDate)}`
                            : 'No pending deadlines'}
                        </span>
                      </div>
                        </div>

                        <div className="pill-row">
                          <span className="pill pill-accent">
                            <strong>{courses.length}</strong> active courses
                          </span>
                          <span className="pill">
                            <strong>{studentStats.submitted}</strong> submissions on record
                          </span>
                          <span className="pill pill-danger">
                            Deadline reminders are highlighted in red chips
                          </span>
                        </div>

                        <div className="legend">
                          <div className="legend-left">
                            <span className="legend-item">
                              <span className="legend-swatch" />
                              Priority deadlines
                            </span>
                            <span className="legend-item">
                              <span className="legend-swatch legend-swatch-muted" />
                              On-track items
                            </span>
                          </div>
                          <div className="legend-right">
                            <span className="legend-chip">
                              Tip: click a course to focus its assignments.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-inner courses-panel">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Courses</div>
                            <div className="panel-title-sub">
                              Browse your classes and the assignments that belong to each course.
                            </div>
                          </div>
                          <div className="panel-badge">
                            {selectedCourse ? selectedCourse.code : 'Select a course'}
                          </div>
                        </div>

                        <div className="courses-list">
                          {courses.map((course) => {
                    const courseAss = assignments.filter((a) => a.courseId === course.id);
                    const total = courseAss.length;
                    const gradedForCourse = courseAss.filter((a) =>
                      a.submissions.some((s) => typeof s.grade === 'number')
                    ).length;
                    const pendingForCourse = courseAss.filter(
                      (a) =>
                        a.submissions.length &&
                        !a.submissions.every((s) => typeof s.grade === 'number')
                    ).length;

                            return (
                              <button
                                key={course.id}
                                type="button"
                                className={`course-item ${
                                  selectedCourseId === course.id ? 'active' : ''
                                }`}
                                onClick={() => setSelectedCourseId(course.id)}
                              >
                        <div className="course-header-row">
                          <div>
                            <div className="course-title">
                              {course.code} · {course.name}
                            </div>
                            <div className="course-meta">
                              <span>{course.term}</span>
                              <span className="dot" />
                              <span>
                                {course.totalAssignments} planned · {total} created in AuroraGrade
                              </span>
                            </div>
                          </div>
                          <div className="tiny-pill">
                            {role === 'student' ? 'Student dashboard' : 'Teacher workspace'}
                          </div>
                        </div>

                        <div className="course-footer-row">
                          <small>
                            {role === 'student'
                              ? 'Tap to see this course’s deadlines and feedback.'
                              : 'Tap to create assignments or grade submissions.'}
                          </small>
                          <div className="course-stats">
                            <span className="course-stat-pill">
                              {gradedForCourse}/{total || 0} graded
                            </span>
                            <span className="course-stat-pill">
                              {pendingForCourse} waiting
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>

                  <section className="secondary-column">
                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                        <div className="panel-title">
                          <div className="panel-title-main">Assignments</div>
                          <div className="panel-title-sub">
                            {selectedCourse
                              ? `${selectedCourse.code} • ${selectedCourse.name}`
                              : 'Select a course to get started.'}
                          </div>
                        </div>

                        <div className="tabs" aria-label="Assignment tabs">
                    <button
                      type="button"
                      className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
                      onClick={() => setActiveTab('assignments')}
                    >
                      <span className="tab-indicator" />
                      To work on
                    </button>
                    <button
                      type="button"
                      className={`tab ${activeTab === 'submissions' ? 'active' : ''}`}
                      onClick={() => setActiveTab('submissions')}
                    >
                      Your submissions
                    </button>
                  </div>
                </div>

                        {activeTab === 'assignments' && (
                          <div className="list">
                            {courseAssignments.length === 0 && (
                      <div className="list-empty">
                        {role === 'student' ? (
                          <>
                            No assignments yet for this course. When your teacher creates one,
                            deadlines will appear here automatically.
                          </>
                        ) : (
                          <>
                            No assignments have been created for this course yet. Use the form
                            below to publish the first one for your students.
                          </>
                        )}
                      </div>
                    )}

                            {courseAssignments.map((assignment) => {
                      const dueIn = daysUntil(assignment.dueDate);
                      const studentSubmission = assignment.submissions.find(
                        (s) => s.studentName === 'You'
                      );
                      const hasGrade =
                        studentSubmission && typeof studentSubmission.grade === 'number';

                      const statusLabel =
                        role === 'student'
                          ? studentSubmission
                            ? hasGrade
                              ? 'Graded'
                              : 'Submitted'
                            : 'Not submitted'
                          : assignment.submissions.length === 0
                            ? 'No submissions yet'
                            : assignment.submissions.every(
                                (s) => typeof s.grade === 'number'
                              )
                              ? 'All graded'
                              : 'Grading in progress';

                      const statusClass =
                        role === 'student'
                          ? hasGrade
                            ? 'graded'
                            : studentSubmission
                              ? 'submitted'
                              : 'pending'
                          : assignment.submissions.length === 0
                            ? 'pending'
                            : assignment.submissions.every(
                                  (s) => typeof s.grade === 'number'
                                )
                              ? 'graded'
                              : 'submitted';

                              return (
                                <div key={assignment.id} className="assignment-item">
                          <div className="assignment-top-row">
                            <div>
                              <div className="assignment-title">{assignment.title}</div>
                              <div className="assignment-meta-row">
                                {assignment.dueDate && (
                                  <>
                                    <span>
                                      Due {formatDate(assignment.dueDate)}{' '}
                                      {dueIn != null && (
                                        <span className="tag-muted">
                                          {dueIn > 1 && `· in ${dueIn} days`}
                                          {dueIn === 1 && '· in 1 day'}
                                          {dueIn === 0 && '· due today'}
                                          {dueIn < 0 && `· ${Math.abs(dueIn)} days late`}
                                        </span>
                                      )}
                                    </span>
                                  </>
                                )}
                                <span>Max {assignment.maxMarks} marks</span>
                                {role === 'student' && hasGrade && (
                                  <span>
                                    Your grade:{' '}
                                    <strong>{studentSubmission.grade}</strong> ·{' '}
                                    <span className="tag-muted">feedback posted</span>
                                  </span>
                                )}
                                {role === 'teacher' && (
                                  <span>
                                    {assignment.submissions.length} submissions ·{' '}
                                    {
                                      assignment.submissions.filter(
                                        (s) => typeof s.grade === 'number'
                                      ).length
                                    }{' '}
                                    graded
                                  </span>
                                )}
                              </div>
                            </div>
                            <span
                              className={`assignment-status-pill ${statusClass} ${
                                dueIn != null && dueIn <= 1 ? 'pill-danger' : ''
                              }`}
                            >
                              {statusLabel}
                            </span>
                          </div>

                          {assignment.description && (
                            <div className="feedback-text">
                              <span className="feedback-label">Brief:</span>{' '}
                              {assignment.description}
                            </div>
                          )}

                                  <div className="assignment-actions-row">
                                    <div className="assignment-meta-row">
                                      {studentSubmission && (
                                        <span>
                                          Last submitted:{' '}
                                          {formatDate(studentSubmission.submittedAt)} ·{' '}
                                          <span className="tag-muted">
                                            {studentSubmission.fileLink || 'No file name recorded'}
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      className="primary-button"
                                      onClick={() => {
                                        setStudentView('submit');
                                        setStudentSubmissionDraft({
                                          assignmentId: assignment.id,
                                          fileName: studentSubmission?.fileLink || '',
                                          fileUrl: studentSubmission?.fileUrl || '',
                                          comments: studentSubmission?.comments || '',
                                        });
                                      }}
                                    >
                                      {studentSubmission ? 'Update submission' : 'Submit assignment'}
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {activeTab === 'submissions' && (
                          <div className="list">
                            {assignments.filter((a) =>
                              a.submissions.some((s) => s.studentName === 'You')
                            ).length === 0 ? (
                              <div className="list-empty">
                                As you submit work, your history of grades and feedback will appear
                                here.
                              </div>
                            ) : (
                              assignments
                                .filter((a) =>
                                  a.submissions.some((s) => s.studentName === 'You')
                                )
                                .map((assignment) => {
                                  const submission = assignment.submissions.find(
                                    (s) => s.studentName === 'You'
                                  );
                                  return (
                                    <div key={assignment.id} className="assignment-item">
                                      <div className="assignment-top-row">
                                        <div>
                                          <div className="assignment-title">
                                            {assignment.title}
                                          </div>
                                          <div className="assignment-meta-row">
                                            <span>
                                              Submitted on{' '}
                                              {formatDate(submission.submittedAt)} ·{' '}
                                              <span className="tag-muted">
                                                {submission.fileLink || 'No file name recorded'}
                                              </span>
                                            </span>
                                            {typeof submission.grade === 'number' ? (
                                              <span>
                                                Grade:{' '}
                                                <strong>{submission.grade}</strong> /{' '}
                                                {assignment.maxMarks}
                                              </span>
                                            ) : (
                                              <span>Waiting for grade</span>
                                            )}
                                          </div>
                                        </div>
                                        <span
                                          className={`assignment-status-pill ${
                                            typeof submission.grade === 'number'
                                              ? 'graded'
                                              : 'submitted'
                                          }`}
                                        >
                                          {typeof submission.grade === 'number'
                                            ? 'Graded'
                                            : 'Submitted'}
                                        </span>
                                      </div>
                                      {submission.feedback && (
                                        <div className="feedback-text">
                                          <span className="feedback-label">Teacher remarks:</span>{' '}
                                          {submission.feedback}
                                        </div>
                                      )}
                                      {submission.comments && (
                                        <div className="feedback-text">
                                          <span className="feedback-label">Your notes:</span>{' '}
                                          {submission.comments}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Submit assignment</div>
                            <div className="panel-title-sub">
                              Attach your work and share any notes you want your teacher to see.
                            </div>
                          </div>
                        </div>

                        <div className="form">
                          <div className="form-row">
                            <label className="form-label">Assignment</label>
                            <select
                              className="form-select"
                              value={studentSubmissionDraft.assignmentId || ''}
                              onChange={(e) => {
                                const id = e.target.value || null;
                                if (!id) {
                                  setStudentSubmissionDraft({
                                    ...EMPTY_STUDENT_SUBMISSION_DRAFT,
                                  });
                                  return;
                                }
                                const assignment = assignments.find((a) => a.id === id);
                                const submission = assignment?.submissions.find(
                                  (s) => s.studentName === 'You'
                                );
                                setStudentSubmissionDraft({
                                  assignmentId: id,
                                  fileName: submission?.fileLink || '',
                                  fileUrl: submission?.fileUrl || '',
                                  comments: submission?.comments || '',
                                });
                              }}
                            >
                              <option value="">Choose an assignment…</option>
                              {assignments.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.title} ({courses.find((c) => c.id === a.courseId)?.code || 'Course'})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-row">
                            <label className="form-label">Upload file</label>
                            <input
                              className="form-input"
                              type="file"
                              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.txt"
                              onChange={(e) => {
                                const file = e.target.files && e.target.files[0];
                                setStudentSubmissionDraft((prev) => ({
                                  ...prev,
                                  fileName: file ? file.name : '',
                                  fileUrl: file ? URL.createObjectURL(file) : '',
                                }));
                              }}
                            />
                            <span className="form-help-text">
                              Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG, ZIP, TXT.
                            </span>
                          </div>
                          <div className="form-row">
                            <label className="form-label">Comments for your teacher (optional)</label>
                            <textarea
                              className="form-textarea"
                              rows={3}
                              placeholder="Share anything that will help your teacher review your work."
                              value={studentSubmissionDraft.comments}
                              onChange={(e) =>
                                setStudentSubmissionDraft((prev) => ({
                                  ...prev,
                                  comments: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-footer">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                setStudentSubmissionDraft({
                                  ...EMPTY_STUDENT_SUBMISSION_DRAFT,
                                })
                              }
                            >
                              Clear form
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              disabled={!canSubmitStudentAssignment}
                              onClick={() =>
                                handleStudentSubmit(studentSubmissionDraft.assignmentId)
                              }
                            >
                              Submit assignment
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                      </>
                    )}

                    {studentView === 'courses' && (
                      <section className="summary-column">
                        <div className="panel">
                          <div className="panel-inner courses-panel">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Courses</div>
                                <div className="panel-title-sub">
                                  Browse and switch between your enrolled classes.
                                </div>
                              </div>
                            </div>
                            <div className="courses-list">
                              {courses.map((course) => (
                                <button
                                  key={course.id}
                                  type="button"
                                  className={`course-item ${
                                    selectedCourseId === course.id ? 'active' : ''
                                  }`}
                                  onClick={() => setSelectedCourseId(course.id)}
                                >
                                  <div className="course-title">
                                    {course.code} · {course.name}
                                  </div>
                                  <div className="course-meta">
                                    <span>{course.term}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {studentView === 'submit' && (
                      <section className="secondary-column">
                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Submit assignment</div>
                                <div className="panel-title-sub">
                                  Upload your work and comments for the selected assignment.
                                </div>
                              </div>
                            </div>
                            <div className="form">
                              <div className="form-row">
                                <label className="form-label">Assignment</label>
                                <select
                                  className="form-select"
                                  value={studentSubmissionDraft.assignmentId || ''}
                                  onChange={(e) => {
                                    const id = e.target.value || null;
                                    if (!id) {
                                      setStudentSubmissionDraft({
                                        ...EMPTY_STUDENT_SUBMISSION_DRAFT,
                                      });
                                      return;
                                    }
                                    const assignment = assignments.find((a) => a.id === id);
                                    const submission = assignment?.submissions.find(
                                      (s) => s.studentName === 'You'
                                    );
                                    setStudentSubmissionDraft({
                                      assignmentId: id,
                                      fileName: submission?.fileLink || '',
                                      fileUrl: submission?.fileUrl || '',
                                      comments: submission?.comments || '',
                                    });
                                  }}
                                >
                                  <option value="">Choose an assignment...</option>
                                  {assignments.map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.title} ({courses.find((c) => c.id === a.courseId)?.code || 'Course'})
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-row">
                                <label className="form-label">Upload file</label>
                                <input
                                  className="form-input"
                                  type="file"
                                  accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.zip,.txt"
                                  onChange={(e) => {
                                    const file = e.target.files && e.target.files[0];
                                    setStudentSubmissionDraft((prev) => ({
                                      ...prev,
                                      fileName: file ? file.name : '',
                                      fileUrl: file ? URL.createObjectURL(file) : '',
                                    }));
                                  }}
                                />
                                <span className="form-help-text">
                                  Supported formats: PDF, DOC, DOCX, JPG, JPEG, PNG, ZIP, TXT.
                                </span>
                              </div>
                              <div className="form-row">
                                <label className="form-label">Comments for your teacher (optional)</label>
                                <textarea
                                  className="form-textarea"
                                  rows={3}
                                  placeholder="Share anything that will help your teacher review your work."
                                  value={studentSubmissionDraft.comments}
                                  onChange={(e) =>
                                    setStudentSubmissionDraft((prev) => ({
                                      ...prev,
                                      comments: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-footer">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    setStudentSubmissionDraft({
                                      ...EMPTY_STUDENT_SUBMISSION_DRAFT,
                                    })
                                  }
                                >
                                  Clear form
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={!canSubmitStudentAssignment}
                                  onClick={() =>
                                    handleStudentSubmit(studentSubmissionDraft.assignmentId)
                                  }
                                >
                                  Submit assignment
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {studentView === 'help' && (
                      <section className="summary-column">
                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Help</div>
                                <div className="panel-title-sub">
                                  Student usage tips for assignments and deadlines.
                                </div>
                              </div>
                            </div>
                            <ul className="login-side-list">
                              <li>Use Home to track deadlines and submission status.</li>
                              <li>Use Submit Assignment to add or update your work.</li>
                              <li>Use Courses to switch to another class.</li>
                            </ul>
                          </div>
                        </div>
                      </section>
                    )}

                    {studentView === 'profile' && (
                      <section className="summary-column">
                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Profile</div>
                                <div className="panel-title-sub">
                                  Account summary for the current student session.
                                </div>
                              </div>
                            </div>
                            <div className="profile-row">
                              <div className="profile-label">Role</div>
                              <div className="profile-value">Student</div>
                            </div>
                            <div className="profile-row">
                              <div className="profile-label">Courses</div>
                              <div className="profile-value">{courses.length}</div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </main>
            </div>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route
        path="/teacher"
        element={
          role === 'teacher' ? (
            <div className="app-shell">
              <header className="app-header">
                <div className="app-header-inner">
                  <div className="brand">
                    <div className="brand-logo">
                      <div className="brand-logo-inner">AG</div>
                    </div>
                    <div className="brand-text">
                      <div className="brand-title">AuroraGrade</div>
                      <div className="brand-subtitle">
                        Teacher workspace • courses, assignments, and grading
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="secondary-button"
                    onClick={handleLogout}
                  >
                    Log out
                  </button>
                </div>
              </header>

              <main className="app-main">
                <div className="app-layout-with-sidebar">
                  <aside className="side-nav">
                    <div className="side-nav-header">
                      <div className="side-nav-title">Teacher</div>
                      <div className="side-nav-subtitle">Teaching workspace</div>
                    </div>
                    <button
                      type="button"
                      className={`side-nav-item ${teacherView === 'home' ? 'active' : ''}`}
                      onClick={() => {
                        setTeacherView('home');
                        setActiveTab('assignments');
                      }}
                    >
                      Home
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${teacherView === 'courses' ? 'active' : ''}`}
                      onClick={() => setTeacherView('courses')}
                    >
                      Courses
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${teacherView === 'assignments' ? 'active' : ''}`}
                      onClick={() => {
                        setTeacherView('assignments');
                        setActiveTab('assignments');
                      }}
                    >
                      Assignments
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${teacherView === 'help' ? 'active' : ''}`}
                      onClick={() => setTeacherView('help')}
                    >
                      Help
                    </button>
                    <button
                      type="button"
                      className={`side-nav-item ${teacherView === 'profile' ? 'active' : ''}`}
                      onClick={() => setTeacherView('profile')}
                    >
                      Profile
                    </button>
                  </aside>
                  <div className="app-main-inner">
                    {teacherView === 'home' && (
                      <>
                  <section className="summary-column">
                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Grading at a glance</div>
                            <div className="panel-title-sub">
                              Monitor submissions, grading load, and feedback quality.
                            </div>
                          </div>
                          <div className="panel-badge">
                            <span className="badge-dot" /> Teacher mode
                          </div>
                        </div>

                        <div className="metrics-row">
                          <div className="metric-pill">
                            <span className="metric-label">Assignments live</span>
                            <span className="metric-value">{headlineStats.assignments}</span>
                            <span className="metric-footnote">across all courses</span>
                          </div>
                          <div className="metric-pill">
                            <span className="metric-label">Submissions graded</span>
                            <span className="metric-value">
                              {headlineStats.graded}/{headlineStats.totalSubmissions || 0}
                            </span>
                            <span className="metric-footnote">feedback shared</span>
                          </div>
                          <div className="metric-pill">
                            <span className="metric-label">Waiting for review</span>
                            <span className="metric-value">{headlineStats.pending}</span>
                            <span className="metric-footnote">submissions still ungraded</span>
                          </div>
                        </div>

                        <div className="pill-row">
                          <span className="pill pill-accent">
                            <strong>{courses.length}</strong> active courses
                          </span>
                          <span className="pill">
                            <strong>{teacherStats.toGrade.length}</strong> at the top of your grading
                            queue
                          </span>
                          <span className="pill pill-danger">
                            Use remarks to turn grades into coaching
                          </span>
                        </div>

                        <div className="legend">
                          <div className="legend-left">
                            <span className="legend-item">
                              <span className="legend-swatch" />
                              New submissions
                            </span>
                            <span className="legend-item">
                              <span className="legend-swatch legend-swatch-muted" />
                              Graded items
                            </span>
                          </div>
                          <div className="legend-right">
                            <span className="legend-chip">
                              Tip: use course cards to jump into a specific class.
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-inner courses-panel">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Courses</div>
                            <div className="panel-title-sub">
                              Pick a course to create new assignments or review submissions.
                            </div>
                          </div>
                          <div className="panel-badge">
                            {selectedCourse ? selectedCourse.code : 'Select a course'}
                          </div>
                        </div>

                        <div className="courses-list">
                          {courses.map((course) => {
                            const courseAss = assignments.filter((a) => a.courseId === course.id);
                            const total = courseAss.length;
                            const gradedForCourse = courseAss.filter((a) =>
                              a.submissions.some((s) => typeof s.grade === 'number')
                            ).length;
                            const pendingForCourse = courseAss.filter(
                              (a) =>
                                a.submissions.length &&
                                !a.submissions.every((s) => typeof s.grade === 'number')
                            ).length;

                            return (
                              <button
                                key={course.id}
                                type="button"
                                className={`course-item ${
                                  selectedCourseId === course.id ? 'active' : ''
                                }`}
                                onClick={() => setSelectedCourseId(course.id)}
                              >
                                <div className="course-header-row">
                                  <div>
                                    <div className="course-title">
                                      {course.code} · {course.name}
                                    </div>
                                    <div className="course-meta">
                                      <span>{course.term}</span>
                                      <span className="dot" />
                                      <span>
                                        {course.totalAssignments} planned · {total} created in
                                        AuroraGrade
                                      </span>
                                    </div>
                                  </div>
                                  <div className="tiny-pill">Teacher workspace</div>
                                </div>

                                <div className="course-footer-row">
                                  <small>
                                    Tap to create assignments or grade submissions for this course.
                                  </small>
                                  <div className="course-stats">
                                    <span className="course-stat-pill">
                                      {gradedForCourse}/{total || 0} graded
                                    </span>
                                    <span className="course-stat-pill">
                                      {pendingForCourse} waiting
                                    </span>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </section>

                  <section className="secondary-column">
                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Assignments & grading</div>
                            <div className="panel-title-sub">
                              {selectedCourse
                                ? `${selectedCourse.code} • ${selectedCourse.name}`
                                : 'Select a course to get started.'}
                            </div>
                          </div>

                          <div className="tabs" aria-label="Assignment tabs">
                            <button
                              type="button"
                              className={`tab ${activeTab === 'assignments' ? 'active' : ''}`}
                              onClick={() => setActiveTab('assignments')}
                            >
                              <span className="tab-indicator" />
                              Assignments
                            </button>
                            <button
                              type="button"
                              className={`tab ${activeTab === 'submissions' ? 'active' : ''}`}
                              onClick={() => setActiveTab('submissions')}
                            >
                              To grade
                            </button>
                          </div>
                        </div>

                        {activeTab === 'assignments' && (
                          <div className="list">
                            {courseAssignments.length === 0 && (
                              <div className="list-empty">
                                No assignments have been created for this course yet. Use the form
                                below to publish the first one for your students.
                              </div>
                            )}

                            {courseAssignments.map((assignment) => {
                              const dueIn = daysUntil(assignment.dueDate);
                              return (
                                <div key={assignment.id} className="assignment-item">
                                  <div className="assignment-top-row">
                                    <div>
                                      <div className="assignment-title">{assignment.title}</div>
                                      <div className="assignment-meta-row">
                                        {assignment.dueDate && (
                                          <>
                                            <span>
                                              Due {formatDate(assignment.dueDate)}{' '}
                                              {dueIn != null && (
                                                <span className="tag-muted">
                                                  {dueIn > 1 && `· in ${dueIn} days`}
                                                  {dueIn === 1 && '· in 1 day'}
                                                  {dueIn === 0 && '· due today'}
                                                  {dueIn < 0 &&
                                                    `· ${Math.abs(dueIn)} days late`}
                                                </span>
                                              )}
                                            </span>
                                          </>
                                        )}
                                        <span>Max {assignment.maxMarks} marks</span>
                                        <span>
                                          {assignment.submissions.length} submissions ·{' '}
                                          {
                                            assignment.submissions.filter(
                                              (s) => typeof s.grade === 'number'
                                            ).length
                                          }{' '}
                                          graded
                                        </span>
                                      </div>
                                    </div>
                                    <span
                                      className={`assignment-status-pill ${
                                        assignment.submissions.length === 0
                                          ? 'pending'
                                          : assignment.submissions.every(
                                              (s) => typeof s.grade === 'number'
                                            )
                                            ? 'graded'
                                            : 'submitted'
                                      }`}
                                    >
                                      {assignment.submissions.length === 0
                                        ? 'No submissions yet'
                                        : assignment.submissions.every(
                                            (s) => typeof s.grade === 'number'
                                          )
                                          ? 'All graded'
                                          : 'Grading in progress'}
                                    </span>
                                  </div>

                                  {assignment.description && (
                                    <div className="feedback-text">
                                      <span className="feedback-label">Brief:</span>{' '}
                                      {assignment.description}
                                    </div>
                                  )}

                                  <div className="assignment-actions-row">
                                    <div className="assignment-meta-row">
                                      {assignment.submissions.length === 0 ? (
                                        <span>No students have submitted this assignment yet.</span>
                                      ) : (
                                        <span>
                                          Next up to grade:{' '}
                                          <span className="tag-muted">
                                            {
                                              assignment.submissions.filter(
                                                (s) => typeof s.grade !== 'number'
                                              ).length
                                            }{' '}
                                            pending
                                          </span>
                                        </span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      className="secondary-button"
                                      onClick={() => {
                                        setActiveTab('submissions');
                                        const ungraded = assignment.submissions.find(
                                          (s) => typeof s.grade !== 'number'
                                        );
                                        if (ungraded) {
                                          setGradingDraft({
                                            assignmentId: assignment.id,
                                            submissionId: ungraded.id,
                                            grade: '',
                                            feedback: '',
                                          });
                                        }
                                      }}
                                    >
                                      Review submissions
                                    </button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {activeTab === 'submissions' && (
                          <div className="list">
                            {teacherStats.toGrade.length === 0 ? (
                              <div className="list-empty">
                                No pending submissions right now. Once students start submitting work,
                                you can grade directly from this panel.
                              </div>
                            ) : (
                              teacherStats.toGrade.map(({ assignment, submission }) => (
                                <div key={submission.id} className="assignment-item">
                                  <div className="assignment-top-row">
                                    <div>
                                      <div className="assignment-title">
                                        {assignment.title}
                                      </div>
                                      <div className="assignment-meta-row">
                                        <span>
                                          Student:{' '}
                                          <strong>{submission.studentName}</strong>
                                        </span>
                                        <span>
                                          Submitted on{' '}
                                          {formatDate(submission.submittedAt)}
                                        </span>
                                        {submission.fileLink && (
                                          <span className="tag-muted">
                                            File:{' '}
                                            {submission.fileUrl ? (
                                              <a href={submission.fileUrl} download={submission.fileLink}>
                                                {submission.fileLink}
                                              </a>
                                            ) : (
                                              submission.fileLink
                                            )}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="assignment-status-pill submitted">
                                      Awaiting grade
                                    </span>
                                  </div>
                                  {submission.comments && (
                                    <div className="feedback-text">
                                      <span className="feedback-label">Student notes:</span>{' '}
                                      {submission.comments}
                                    </div>
                                  )}

                                  <div className="form">
                                    <div className="form-row">
                                      <label className="form-label">
                                        Grade (out of {assignment.maxMarks})
                                      </label>
                                      <input
                                        className="form-input"
                                        type="number"
                                        value={
                                          gradingDraft.assignmentId === assignment.id &&
                                          gradingDraft.submissionId === submission.id
                                            ? gradingDraft.grade
                                            : ''
                                        }
                                        onChange={(e) =>
                                          setGradingDraft({
                                            assignmentId: assignment.id,
                                            submissionId: submission.id,
                                            grade: e.target.value,
                                            feedback:
                                              gradingDraft.assignmentId === assignment.id &&
                                              gradingDraft.submissionId === submission.id
                                                ? gradingDraft.feedback
                                                : '',
                                          })
                                        }
                                      />
                                    </div>
                                    <div className="form-row">
                                      <label className="form-label">
                                        Feedback / remarks for the student
                                      </label>
                                      <textarea
                                        className="form-textarea"
                                        rows={3}
                                        value={
                                          gradingDraft.assignmentId === assignment.id &&
                                          gradingDraft.submissionId === submission.id
                                            ? gradingDraft.feedback
                                            : ''
                                        }
                                        onChange={(e) =>
                                          setGradingDraft((prev) => ({
                                            ...prev,
                                            assignmentId: assignment.id,
                                            submissionId: submission.id,
                                            feedback: e.target.value,
                                          }))
                                        }
                                        placeholder="Highlight strengths, suggest improvements, and point to specific lines or concepts."
                                      />
                                    </div>
                                    <div className="form-footer">
                                      <button
                                        type="button"
                                        className="secondary-button"
                                        onClick={() =>
                                          setGradingDraft({
                                            assignmentId: null,
                                            submissionId: null,
                                            grade: '',
                                            feedback: '',
                                          })
                                        }
                                      >
                                        Cancel
                                      </button>
                                      <button
                                        type="button"
                                        className="primary-button"
                                        onClick={handleGradeSubmit}
                                      >
                                        Save grade & remarks
                                      </button>
                                    </div>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Create assignment</div>
                            <div className="panel-title-sub">
                              Add a new assignment to a course and set a clear deadline.
                            </div>
                          </div>
                        </div>

                        <div className="form">
                          <div className="form-row">
                            <label className="form-label">Course</label>
                            <select
                              className="form-select"
                              value={teacherAssignmentDraft.courseId}
                              onChange={(e) =>
                                setTeacherAssignmentDraft((prev) => ({
                                  ...prev,
                                  courseId: e.target.value,
                                }))
                              }
                            >
                              {courses.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.code} · {c.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="form-row">
                            <label className="form-label">Title</label>
                            <input
                              className="form-input"
                              type="text"
                              placeholder="e.g. Project 1: Portfolio website"
                              value={teacherAssignmentDraft.title}
                              onChange={(e) =>
                                setTeacherAssignmentDraft((prev) => ({
                                  ...prev,
                                  title: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Description / instructions</label>
                            <textarea
                              className="form-textarea"
                              rows={3}
                              placeholder="Outline requirements, deliverables, and any supporting resources."
                              value={teacherAssignmentDraft.description}
                              onChange={(e) =>
                                setTeacherAssignmentDraft((prev) => ({
                                  ...prev,
                                  description: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Due date</label>
                            <input
                              className="form-input"
                              type="date"
                              value={teacherAssignmentDraft.dueDate}
                              onChange={(e) =>
                                setTeacherAssignmentDraft((prev) => ({
                                  ...prev,
                                  dueDate: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Max marks</label>
                            <input
                              className="form-input"
                              type="number"
                              value={teacherAssignmentDraft.maxMarks}
                              onChange={(e) =>
                                setTeacherAssignmentDraft((prev) => ({
                                  ...prev,
                                  maxMarks: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-footer">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                setTeacherAssignmentDraft({
                                  courseId: teacherAssignmentDraft.courseId,
                                  title: '',
                                  description: '',
                                  dueDate: '',
                                  maxMarks: 100,
                                })
                              }
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              disabled={!teacherAssignmentDraft.title.trim()}
                              onClick={handleCreateAssignment}
                            >
                              Publish assignment
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="panel">
                      <div className="panel-inner">
                        <div className="panel-header">
                          <div className="panel-title">
                            <div className="panel-title-main">Create course</div>
                            <div className="panel-title-sub">
                              Add a new course that can hold assignments and submissions.
                            </div>
                          </div>
                        </div>

                        <div className="form">
                          <div className="form-row">
                            <label className="form-label">Course code</label>
                            <input
                              className="form-input"
                              type="text"
                              placeholder="e.g. CS450"
                              value={newCourseDraft.code}
                              onChange={(e) =>
                                setNewCourseDraft((prev) => ({
                                  ...prev,
                                  code: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Course name</label>
                            <input
                              className="form-input"
                              type="text"
                              placeholder="e.g. Machine Learning"
                              value={newCourseDraft.name}
                              onChange={(e) =>
                                setNewCourseDraft((prev) => ({
                                  ...prev,
                                  name: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Term</label>
                            <input
                              className="form-input"
                              type="text"
                              placeholder="e.g. Spring 2026"
                              value={newCourseDraft.term}
                              onChange={(e) =>
                                setNewCourseDraft((prev) => ({
                                  ...prev,
                                  term: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-row">
                            <label className="form-label">Planned number of assignments</label>
                            <input
                              className="form-input"
                              type="number"
                              value={newCourseDraft.totalAssignments}
                              onChange={(e) =>
                                setNewCourseDraft((prev) => ({
                                  ...prev,
                                  totalAssignments: e.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="form-footer">
                            <button
                              type="button"
                              className="secondary-button"
                              onClick={() =>
                                setNewCourseDraft({
                                  code: '',
                                  name: '',
                                  term: newCourseDraft.term,
                                  totalAssignments: 0,
                                })
                              }
                            >
                              Reset
                            </button>
                            <button
                              type="button"
                              className="primary-button"
                              disabled={!newCourseDraft.code.trim() || !newCourseDraft.name.trim()}
                              onClick={handleCreateCourse}
                            >
                              Add course
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                      </>
                    )}

                    {teacherView === 'courses' && (
                      <section className="summary-column">
                        <div className="panel">
                          <div className="panel-inner courses-panel">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Courses</div>
                                <div className="panel-title-sub">
                                  Manage courses and add new classes.
                                </div>
                              </div>
                            </div>
                            <div className="courses-list">
                              {courses.map((course) => (
                                <button
                                  key={course.id}
                                  type="button"
                                  className={`course-item ${
                                    selectedCourseId === course.id ? 'active' : ''
                                  }`}
                                  onClick={() => setSelectedCourseId(course.id)}
                                >
                                  <div className="course-title">
                                    {course.code} · {course.name}
                                  </div>
                                  <div className="course-meta">
                                    <span>{course.term}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Create course</div>
                                <div className="panel-title-sub">
                                  Add a new course for your students.
                                </div>
                              </div>
                            </div>
                            <div className="form">
                              <div className="form-row">
                                <label className="form-label">Course code</label>
                                <input
                                  className="form-input"
                                  type="text"
                                  placeholder="e.g. CS450"
                                  value={newCourseDraft.code}
                                  onChange={(e) =>
                                    setNewCourseDraft((prev) => ({
                                      ...prev,
                                      code: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-row">
                                <label className="form-label">Course name</label>
                                <input
                                  className="form-input"
                                  type="text"
                                  placeholder="e.g. Machine Learning"
                                  value={newCourseDraft.name}
                                  onChange={(e) =>
                                    setNewCourseDraft((prev) => ({
                                      ...prev,
                                      name: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-row">
                                <label className="form-label">Term</label>
                                <input
                                  className="form-input"
                                  type="text"
                                  placeholder="e.g. Spring 2026"
                                  value={newCourseDraft.term}
                                  onChange={(e) =>
                                    setNewCourseDraft((prev) => ({
                                      ...prev,
                                      term: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-footer">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    setNewCourseDraft({
                                      code: '',
                                      name: '',
                                      term: newCourseDraft.term,
                                      totalAssignments: 0,
                                    })
                                  }
                                >
                                  Reset
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={!newCourseDraft.code.trim() || !newCourseDraft.name.trim()}
                                  onClick={handleCreateCourse}
                                >
                                  Add course
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {teacherView === 'assignments' && (
                      <section className="secondary-column">
                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Assignments & grading</div>
                                <div className="panel-title-sub">
                                  Focused view for assignment list and publishing.
                                </div>
                              </div>
                            </div>
                            <div className="list">
                              {courseAssignments.length === 0 ? (
                                <div className="list-empty">
                                  No assignments created for this course.
                                </div>
                              ) : (
                                courseAssignments.map((assignment) => (
                                  <div key={assignment.id} className="assignment-item">
                                    <div className="assignment-title">{assignment.title}</div>
                                    <div className="assignment-meta-row">
                                      <span>Due {formatDate(assignment.dueDate)}</span>
                                      <span>{assignment.submissions.length} submissions</span>
                                      <span>Max {assignment.maxMarks}</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Create assignment</div>
                                <div className="panel-title-sub">
                                  Add a new assignment to the selected course.
                                </div>
                              </div>
                            </div>
                            <div className="form">
                              <div className="form-row">
                                <label className="form-label">Course</label>
                                <select
                                  className="form-select"
                                  value={teacherAssignmentDraft.courseId}
                                  onChange={(e) =>
                                    setTeacherAssignmentDraft((prev) => ({
                                      ...prev,
                                      courseId: e.target.value,
                                    }))
                                  }
                                >
                                  {courses.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.code} · {c.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div className="form-row">
                                <label className="form-label">Title</label>
                                <input
                                  className="form-input"
                                  type="text"
                                  placeholder="e.g. Project 1: Portfolio website"
                                  value={teacherAssignmentDraft.title}
                                  onChange={(e) =>
                                    setTeacherAssignmentDraft((prev) => ({
                                      ...prev,
                                      title: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-row">
                                <label className="form-label">Due date</label>
                                <input
                                  className="form-input"
                                  type="date"
                                  value={teacherAssignmentDraft.dueDate}
                                  onChange={(e) =>
                                    setTeacherAssignmentDraft((prev) => ({
                                      ...prev,
                                      dueDate: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-row">
                                <label className="form-label">Max marks</label>
                                <input
                                  className="form-input"
                                  type="number"
                                  value={teacherAssignmentDraft.maxMarks}
                                  onChange={(e) =>
                                    setTeacherAssignmentDraft((prev) => ({
                                      ...prev,
                                      maxMarks: e.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="form-footer">
                                <button
                                  type="button"
                                  className="secondary-button"
                                  onClick={() =>
                                    setTeacherAssignmentDraft({
                                      courseId: teacherAssignmentDraft.courseId,
                                      title: '',
                                      description: '',
                                      dueDate: '',
                                      maxMarks: 100,
                                    })
                                  }
                                >
                                  Reset
                                </button>
                                <button
                                  type="button"
                                  className="primary-button"
                                  disabled={!teacherAssignmentDraft.title.trim()}
                                  onClick={handleCreateAssignment}
                                >
                                  Publish assignment
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}

                    {teacherView === 'help' && (
                      <section className="summary-column">
                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Help</div>
                                <div className="panel-title-sub">
                                  Guidance for creating assignments and grading submissions.
                                </div>
                              </div>
                            </div>
                            <ul className="login-side-list">
                              <li>Use Home for grading queue and assignment overview.</li>
                              <li>Use Courses to manage course catalog.</li>
                              <li>Use Assignments to focus only on assignment workflows.</li>
                            </ul>
                          </div>
                        </div>
                      </section>
                    )}

                    {teacherView === 'profile' && (
                      <section className="summary-column">
                        <div className="panel">
                          <div className="panel-inner">
                            <div className="panel-header">
                              <div className="panel-title">
                                <div className="panel-title-main">Profile</div>
                                <div className="panel-title-sub">
                                  Account summary for the current teacher session.
                                </div>
                              </div>
                            </div>
                            <div className="profile-row">
                              <div className="profile-label">Role</div>
                              <div className="profile-value">Teacher</div>
                            </div>
                            <div className="profile-row">
                              <div className="profile-label">Courses</div>
                              <div className="profile-value">{courses.length}</div>
                            </div>
                            <div className="profile-row">
                              <div className="profile-label">Assignments</div>
                              <div className="profile-value">{assignments.length}</div>
                            </div>
                          </div>
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </main>
            </div>
          ) : (
            <Navigate to="/" replace />
          )
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;

