import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
const LinkedInCallback = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');

    if (code) {
      fetch(`http://localhost:5000/linkedin/callback?code=${code}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.localizedFirstName) {
            console.log('LinkedIn Profile:', data);
            localStorage.setItem('linkedinUser', JSON.stringify(data));
            navigate('/network-analysis',); // Correct way to navigate
          } else {
            console.error('Failed to fetch LinkedIn profile');
            navigate('/error');
          }
        })
        .catch((err) => {
          console.error('Error:', err);
          navigate('/error');
        });
    } else {
      navigate('/error');
    }
  }, [navigate]);

  return <div>Logging you in with LinkedIn...</div>;
};

export default LinkedInCallback;
