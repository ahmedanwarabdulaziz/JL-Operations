import React from 'react';
import {
  Box,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  useTheme,
  useMediaQuery,
  Paper,
  Avatar,
  Button
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import BusinessIcon from '@mui/icons-material/Business';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import GroupIcon from '@mui/icons-material/Group';
import SecurityIcon from '@mui/icons-material/Security';
import SupportIcon from '@mui/icons-material/Support';
import InnovationIcon from '@mui/icons-material/AutoAwesome';

const AboutPage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const values = [
    {
      icon: <InnovationIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Innovation',
      description: 'We continuously innovate and adapt to new technologies to provide cutting-edge solutions.'
    },
    {
      icon: <SecurityIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Reliability',
      description: 'Our systems are built with reliability and security at the core, ensuring your business continuity.'
    },
    {
      icon: <SupportIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Excellence',
      description: 'We strive for excellence in everything we do, from customer service to technical solutions.'
    },
    {
      icon: <GroupIcon sx={{ fontSize: 40, color: theme.palette.primary.main }} />,
      title: 'Partnership',
      description: 'We believe in building long-term partnerships with our clients, working together for mutual success.'
    }
  ];

  const stats = [
    { number: '500+', label: 'Happy Clients' },
    { number: '50+', label: 'Years Combined Experience' },
    { number: '99%', label: 'Client Satisfaction' },
    { number: '24/7', label: 'Support Available' }
  ];

  const team = [
    {
      name: 'John Smith',
      position: 'CEO & Founder',
      avatar: <Avatar sx={{ width: 80, height: 80, bgcolor: theme.palette.primary.main }}>JS</Avatar>,
      bio: 'Over 20 years of experience in operations management and business optimization.'
    },
    {
      name: 'Sarah Johnson',
      position: 'Operations Director',
      avatar: <Avatar sx={{ width: 80, height: 80, bgcolor: theme.palette.secondary.main }}>SJ</Avatar>,
      bio: 'Specialized in process improvement and workflow automation for manufacturing industries.'
    },
    {
      name: 'Michael Chen',
      position: 'Technical Lead',
      avatar: <Avatar sx={{ width: 80, height: 80, bgcolor: theme.palette.success.main }}>MC</Avatar>,
      bio: 'Expert in developing scalable software solutions and system architecture.'
    }
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
          color: 'white',
          py: { xs: 6, md: 8 },
          textAlign: 'center'
        }}
      >
        <Container maxWidth="lg">
          <Typography
            variant={isMobile ? 'h3' : 'h2'}
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 'bold',
              mb: 3
            }}
          >
            About JL Operations
          </Typography>
          <Typography
            variant="h6"
            sx={{
              opacity: 0.9,
              maxWidth: 800,
              mx: 'auto'
            }}
          >
            We are a team of passionate professionals dedicated to transforming business operations 
            through innovative technology and strategic solutions.
          </Typography>
        </Container>
      </Box>

      {/* Our Story */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Grid container spacing={6} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography
              variant="h3"
              component="h2"
              gutterBottom
              sx={{ fontWeight: 'bold', mb: 3 }}
            >
              Our Story
            </Typography>
            <Typography
              variant="body1"
              paragraph
              sx={{ fontSize: '1.1rem', lineHeight: 1.8, mb: 3 }}
            >
              Founded with a vision to revolutionize how businesses manage their operations, 
              JL Operations has grown from a small startup to a trusted partner for hundreds 
              of companies across various industries.
            </Typography>
            <Typography
              variant="body1"
              paragraph
              sx={{ fontSize: '1.1rem', lineHeight: 1.8, mb: 3 }}
            >
              Our journey began when we identified a common challenge: businesses were struggling 
              with inefficient processes, scattered data, and lack of real-time insights. We set 
              out to create comprehensive solutions that would address these pain points.
            </Typography>
            <Typography
              variant="body1"
              sx={{ fontSize: '1.1rem', lineHeight: 1.8 }}
            >
              Today, we continue to innovate and evolve, always staying ahead of industry trends 
              and technological advancements to provide our clients with the best possible solutions.
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                background: `linear-gradient(135deg, ${theme.palette.primary.light} 0%, ${theme.palette.primary.main} 100%)`,
                color: 'white'
              }}
            >
              <Typography variant="h4" component="h3" gutterBottom sx={{ fontWeight: 'bold' }}>
                Our Mission
              </Typography>
              <Typography variant="body1" paragraph sx={{ fontSize: '1.1rem', mb: 3 }}>
                To empower businesses with innovative technology solutions that streamline operations, 
                enhance productivity, and drive sustainable growth.
              </Typography>
              <Typography variant="h5" component="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                Our Vision
              </Typography>
              <Typography variant="body1" sx={{ fontSize: '1.1rem' }}>
                To be the leading provider of comprehensive business operations solutions, 
                helping organizations thrive in the digital age.
              </Typography>
            </Paper>
          </Grid>
        </Grid>
      </Container>

      {/* Stats Section */}
      <Box sx={{ backgroundColor: '#f5f5f5', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            textAlign="center"
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 6 }}
          >
            Our Impact
          </Typography>
          <Grid container spacing={4}>
            {stats.map((stat, index) => (
              <Grid item xs={6} md={3} key={index}>
                <Box textAlign="center">
                  <Typography
                    variant="h2"
                    component="div"
                    sx={{
                      fontWeight: 'bold',
                      color: theme.palette.primary.main,
                      mb: 1
                    }}
                  >
                    {stat.number}
                  </Typography>
                  <Typography
                    variant="h6"
                    color="text.secondary"
                    sx={{ fontWeight: 500 }}
                  >
                    {stat.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* Values Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Typography
          variant="h3"
          component="h2"
          textAlign="center"
          gutterBottom
          sx={{ fontWeight: 'bold', mb: 6 }}
        >
          Our Values
        </Typography>
        <Grid container spacing={4}>
          {values.map((value, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  textAlign: 'center',
                  p: 3,
                  transition: 'transform 0.2s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)'
                  }
                }}
              >
                <CardContent>
                  <Box sx={{ mb: 2 }}>
                    {value.icon}
                  </Box>
                  <Typography
                    variant="h5"
                    component="h3"
                    gutterBottom
                    sx={{ fontWeight: 600, mb: 2 }}
                  >
                    {value.title}
                  </Typography>
                  <Typography
                    variant="body1"
                    color="text.secondary"
                  >
                    {value.description}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>

      {/* Team Section */}
      <Box sx={{ backgroundColor: '#f5f5f5', py: { xs: 6, md: 8 } }}>
        <Container maxWidth="lg">
          <Typography
            variant="h3"
            component="h2"
            textAlign="center"
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 6 }}
          >
            Meet Our Team
          </Typography>
          <Grid container spacing={4}>
            {team.map((member, index) => (
              <Grid item xs={12} md={4} key={index}>
                <Card
                  sx={{
                    textAlign: 'center',
                    p: 3,
                    height: '100%',
                    transition: 'transform 0.2s ease-in-out',
                    '&:hover': {
                      transform: 'translateY(-4px)'
                    }
                  }}
                >
                  <CardContent>
                    <Box sx={{ mb: 3 }}>
                      {member.avatar}
                    </Box>
                    <Typography
                      variant="h5"
                      component="h3"
                      gutterBottom
                      sx={{ fontWeight: 600 }}
                    >
                      {member.name}
                    </Typography>
                    <Typography
                      variant="h6"
                      color="primary"
                      gutterBottom
                      sx={{ fontWeight: 500, mb: 2 }}
                    >
                      {member.position}
                    </Typography>
                    <Typography
                      variant="body1"
                      color="text.secondary"
                    >
                      {member.bio}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* CTA Section */}
      <Container maxWidth="lg" sx={{ py: { xs: 6, md: 8 } }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 4, md: 6 },
            textAlign: 'center',
            background: `linear-gradient(135deg, ${theme.palette.primary.main} 0%, ${theme.palette.primary.dark} 100%)`,
            color: 'white'
          }}
        >
          <Typography
            variant={isMobile ? 'h4' : 'h3'}
            component="h2"
            gutterBottom
            sx={{ fontWeight: 'bold', mb: 3 }}
          >
            Ready to Work Together?
          </Typography>
          <Typography
            variant="h6"
            paragraph
            sx={{ mb: 4, opacity: 0.9 }}
          >
            Let's discuss how we can help transform your business operations and drive growth.
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button
              component={RouterLink}
              to="/contact"
              variant="contained"
              size="large"
              sx={{
                backgroundColor: 'white',
                color: theme.palette.primary.main,
                textTransform: 'none',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                '&:hover': {
                  backgroundColor: 'rgba(255, 255, 255, 0.9)'
                }
              }}
            >
              Get in Touch
            </Button>
            <Button
              component={RouterLink}
              to="/services"
              variant="outlined"
              size="large"
              sx={{
                borderColor: 'white',
                color: 'white',
                textTransform: 'none',
                fontWeight: 600,
                px: 4,
                py: 1.5,
                '&:hover': {
                  borderColor: 'white',
                  backgroundColor: 'rgba(255, 255, 255, 0.1)'
                }
              }}
            >
              Our Services
            </Button>
          </Box>
        </Paper>
      </Container>
    </Box>
  );
};

export default AboutPage;
