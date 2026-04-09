(async () => {
  try {
    const res = await fetch('http://localhost:8080/api/assignments');
    const text = await res.text();
    console.log('response length: ' + text.length);

    let data;
    try {
      data = JSON.parse(text);
      console.log('JSON parse: success');
    } catch (e) {
      console.log('JSON parse: failure');
      console.log('assignment count: n/a');
      console.log('first assignment keys: n/a');
      console.log('first submission keys: n/a');
      console.log("first submission has 'assignment' key: n/a");
      return;
    }

    const assignments = Array.isArray(data) ? data : [];
    console.log('assignment count: ' + assignments.length);

    const firstAssignment = assignments[0] && typeof assignments[0] === 'object' ? assignments[0] : null;
    const assignmentKeys = firstAssignment ? Object.keys(firstAssignment) : [];
    console.log('first assignment keys: ' + (assignmentKeys.length ? assignmentKeys.join(', ') : '(none)'));

    const submissions = firstAssignment && Array.isArray(firstAssignment.submissions) ? firstAssignment.submissions : [];
    const firstSubmission = submissions[0] && typeof submissions[0] === 'object' ? submissions[0] : null;
    const submissionKeys = firstSubmission ? Object.keys(firstSubmission) : [];
    console.log('first submission keys: ' + (submissionKeys.length ? submissionKeys.join(', ') : '(none)'));
    console.log("first submission has 'assignment' key: " + (firstSubmission ? Object.prototype.hasOwnProperty.call(firstSubmission, 'assignment') : false));
  } catch (err) {
    console.log('response length: n/a');
    console.log('JSON parse: failure');
    console.log('assignment count: n/a');
    console.log('first assignment keys: n/a');
    console.log('first submission keys: n/a');
    console.log("first submission has 'assignment' key: n/a");
    console.log('request error: ' + err.message);
  }
})();
