import React, { useState, useEffect } from 'react';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  useTheme,
  useMediaQuery
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { buttonStyles } from '../../styles/buttonStyles';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

// Typewriter Animation Component
const TypewriterText = ({ text, speed = 100, delay = 1000, className = '', sx = {} }) => {
  const [displayText, setDisplayText] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsTyping(true);
    }, delay);

    return () => clearTimeout(timer);
  }, [delay]);

  useEffect(() => {
    if (!isTyping) return;

    if (currentIndex < text.length) {
      const timer = setTimeout(() => {
        setDisplayText(prev => prev + text[currentIndex]);
        setCurrentIndex(prev => prev + 1);
      }, speed);

      return () => clearTimeout(timer);
    }
  }, [currentIndex, isTyping, text, speed]);

  return (
    <Typography 
      className={className}
      sx={{
        position: 'relative',
        '&::after': {
          content: '""',
          position: 'absolute',
          right: '-4px',
          top: '0',
          height: '100%',
          width: '2px',
          backgroundColor: '#b98f33',
          animation: isTyping && currentIndex < text.length ? 'blink 1s infinite' : 'none',
          '@keyframes blink': {
            '0%, 50%': { opacity: 1 },
            '51%, 100%': { opacity: 0 }
          }
        },
        ...sx
      }}
    >
      {displayText}
    </Typography>
  );
};

const HomePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeReviewCard, setActiveReviewCard] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [heroAnimations, setHeroAnimations] = useState({
    titleVisible: false,
    subtitleVisible: false,
    descriptionVisible: false,
    buttonsVisible: false
  });
  const [whyUsAnimations, setWhyUsAnimations] = useState({
    titleVisible: false,
    cardsVisible: [false, false, false]
  });
  const [whyUsTriggered, setWhyUsTriggered] = useState(false);

  // Auto-scroll effect for partners carousel
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSlide((prevSlide) => (prevSlide + 1) % 7);
    }, 3000); // Change slide every 3 seconds

    return () => clearInterval(interval);
  }, []);

  // Auto-play effect for review cards
  useEffect(() => {
    if (isPaused) return;

    const interval = setInterval(() => {
      setActiveReviewCard((prevCard) => (prevCard + 1) % 7);
    }, 4000); // Change card every 4 seconds

    return () => clearInterval(interval);
  }, [isPaused]);

  // Hero section animations
  useEffect(() => {
    const timer1 = setTimeout(() => setHeroAnimations(prev => ({ ...prev, titleVisible: true })), 300);
    const timer2 = setTimeout(() => setHeroAnimations(prev => ({ ...prev, subtitleVisible: true })), 800);
    const timer3 = setTimeout(() => setHeroAnimations(prev => ({ ...prev, descriptionVisible: true })), 1300);
    const timer4 = setTimeout(() => setHeroAnimations(prev => ({ ...prev, buttonsVisible: true })), 1800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timer4);
    };
  }, []);

  // Why Us section scroll animations
  useEffect(() => {
    // Don't add listener if already triggered
    if (whyUsTriggered) return;

    const handleScroll = () => {
      const whyUsSection = document.getElementById('why-us-section');
      if (whyUsSection) {
        const rect = whyUsSection.getBoundingClientRect();
        const windowHeight = window.innerHeight;
        
        // Trigger when section is 30% visible
        if (rect.top < windowHeight * 0.7) {
          setWhyUsTriggered(true); // Prevent re-triggering
          setWhyUsAnimations(prev => ({ ...prev, titleVisible: true }));
          
          // Stagger the cards animation
          setTimeout(() => setWhyUsAnimations(prev => ({ ...prev, cardsVisible: [true, false, false] })), 300);
          setTimeout(() => setWhyUsAnimations(prev => ({ ...prev, cardsVisible: [true, true, false] })), 600);
          setTimeout(() => setWhyUsAnimations(prev => ({ ...prev, cardsVisible: [true, true, true] })), 900);
          
          // Remove the scroll listener immediately after triggering
          window.removeEventListener('scroll', handleScroll);
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [whyUsTriggered]);

  // Handle card click
  const handleCardClick = (index) => {
    setActiveReviewCard(index);
  };

  // Handle dot click
  const handleDotClick = (index) => {
    setActiveReviewCard(index);
  };

  const services = [
    {
      title: 'Indoor Home',
      subtitle: 'Upholstery Services',
      description: 'Give your beloved indoor furniture a second chance at life with our expert craftsmanship and designer fabric selection.',
      image: '/assets/images/x002.png'
    },
    {
      title: 'Commercial',
      subtitle: 'Upholstery Services',
      description: 'Professional upholstery solutions that keep your business looking polished while maximizing your furniture investment.',
      image: '/assets/images/x004.png'
    },
    {
      title: 'Outdoor Home',
      subtitle: 'Upholstery Services',
      description: 'Extend your outdoor living season with expertly crafted, weather-resistant upholstery designed for Canadian climates.',
      image: '/assets/images/x003.png'
    }
  ];

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          backgroundImage: 'url(/assets/images/x001.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          color: 'white',
          py: { xs: 8, md: 12 },
          minHeight: { xs: '60vh', md: '80vh' },
          display: 'flex',
          alignItems: 'center',
          position: 'relative',
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(90deg, rgba(0, 0, 0, 0.7) 0%, rgba(0, 0, 0, 0.4) 40%, rgba(0, 0, 0, 0.1) 70%, transparent 100%)',
            zIndex: 1
          }
        }}
      >
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100%' }}>
          <Box sx={{ textAlign: 'center', width: '100%' }}>
              <Typography
                variant={isMobile ? 'h3' : 'h2'}
                component="h1"
                gutterBottom
                sx={{
                   fontFamily: '"Playfair Display", "Times New Roman", serif',
                   fontWeight: 700,
                   lineHeight: 1.1,
                   mb: 3,
                   textShadow: '2px 2px 4px rgba(0,0,0,0.7)',
                   color: '#ffffff',
                   letterSpacing: '-0.02em',
                   fontSize: { xs: '2.5rem', md: '3.5rem' },
                   textAlign: 'center',
                   opacity: heroAnimations.titleVisible ? 1 : 0,
                   transform: heroAnimations.titleVisible ? 'translateY(0)' : 'translateY(30px)',
                   transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)'
                 }}
               >
                 Bringing Furniture Value
              </Typography>
              <Typography
                 variant="h5"
                 paragraph
                 sx={{
                   fontFamily: '"Inter", "Roboto", sans-serif',
                   mb: 3,
                   opacity: heroAnimations.subtitleVisible ? 0.95 : 0,
                   lineHeight: 1.4,
                   textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                   fontWeight: 400,
                   color: '#ffffff',
                   fontSize: { xs: '1.25rem', md: '1.5rem' },
                   letterSpacing: '0.01em',
                   textAlign: 'center',
                   transform: heroAnimations.subtitleVisible ? 'translateY(0)' : 'translateY(20px)',
                   transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                   animation: heroAnimations.subtitleVisible ? 'subtitleFloat 4s ease-in-out infinite' : 'none',
                   '@keyframes subtitleFloat': {
                     '0%, 100%': {
                       transform: 'translateY(0)'
                     },
                     '50%': {
                       transform: 'translateY(-5px)'
                     }
                   }
                 }}
               >
                 We believe everyone has the right to a well-furnished life
               </Typography>
              <Typography
                variant="body1"
                paragraph
                sx={{
                  mb: 4,
                  opacity: heroAnimations.descriptionVisible ? 0.9 : 0,
                  lineHeight: 1.8,
                  fontSize: '1.1rem',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  maxWidth: '600px',
                  color: '#ffffff',
                  textAlign: 'center',
                  mx: 'auto',
                  transform: heroAnimations.descriptionVisible ? 'translateY(0)' : 'translateY(20px)',
                  transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                  animation: heroAnimations.descriptionVisible ? 'descriptionFade 5s ease-in-out infinite' : 'none',
                  '@keyframes descriptionFade': {
                    '0%, 100%': {
                      opacity: 0.9
                    },
                    '50%': {
                      opacity: 1
                    }
                  }
                }}
              >
                At JL Upholstery, we believe everyone has the right to a well-furnished life. Our team of 20+ fabric experts and skilled upholsterers specializes in custom re-upholstery, combining creativity, passion, and expertise with your vision to give the furniture you love a second chance at life.
              </Typography>
              <Box sx={{ 
                display: 'flex', 
                gap: 2, 
                flexWrap: 'wrap',
                justifyContent: 'center',
                opacity: heroAnimations.buttonsVisible ? 1 : 0,
                transform: heroAnimations.buttonsVisible ? 'translateY(0)' : 'translateY(30px)',
                transition: 'all 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                animation: heroAnimations.buttonsVisible ? 'buttonsPulse 6s ease-in-out infinite' : 'none',
                '@keyframes buttonsPulse': {
                  '0%, 100%': {
                    transform: 'translateY(0) scale(1)'
                  },
                  '50%': {
                    transform: 'translateY(-3px) scale(1.02)'
                  }
                }
              }}>
                <Button
                  component={RouterLink}
                  to="/services"
                  variant="contained"
                  size="large"
                  sx={buttonStyles.homePageButton}
                >
                  Explore Services
                </Button>
                <Button
                  component={RouterLink}
                  to="/contact"
                  variant="contained"
                  size="large"
                  sx={buttonStyles.homePageOutlineButton}
                >
                  Contact Us
                </Button>
              </Box>
            </Box>
        </Container>
      </Box>
 
               {/* Quote Section */}
        <Box sx={{ 
          py: { xs: 6, md: 10 },
          backgroundColor: '#f8f8f8'
        }}>
          <Container maxWidth="xl">
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: 3,
              alignItems: 'stretch'
            }}>
              {/* Card 1 - Left */}
              <Card sx={{
                flex: { xs: '0 0 auto', md: '1 1 0' },
                width: { xs: '100%', md: 'auto' },
                height: { xs: 'auto', md: '350px' },
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(185, 143, 51, 0.1)',
                border: '2px solid rgba(185, 143, 51, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 6px 16px rgba(185, 143, 51, 0.15)',
                  border: '2px solid rgba(185, 143, 51, 0.3)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 50%, #b98f33 100%)',
                  borderRadius: '16px 16px 0 0',
                  zIndex: 1
                }
              }}>
                <Box sx={{
                  height: { xs: '200px', md: '210px' },
                  width: '100%',
                  backgroundImage: 'url(/assets/images/x007.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }} />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', p: { xs: 2, md: 3 } }}>
                  <Typography sx={{
                    fontFamily: '"Playfair Display", "Times New Roman", serif',
                    fontWeight: 700,
                    color: '#b98f33',
                    fontSize: { xs: '1.2rem', md: '1.3rem' },
                    mb: 1.5,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    30+ Years
                  </Typography>
                  <Typography sx={{
                    fontFamily: '"Inter", sans-serif',
                    color: '#666666',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    lineHeight: 1.6,
                    textAlign: 'center'
                  }}>
                    Of Craftsmanship Excellence
                  </Typography>
                </CardContent>
              </Card>

              {/* Card 2 - Right */}
              <Card sx={{
                flex: { xs: '0 0 auto', md: '1 1 0' },
                width: { xs: '100%', md: 'auto' },
                height: { xs: 'auto', md: '350px' },
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(185, 143, 51, 0.1)',
                border: '2px solid rgba(185, 143, 51, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 6px 16px rgba(185, 143, 51, 0.15)',
                  border: '2px solid rgba(185, 143, 51, 0.3)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 50%, #b98f33 100%)',
                  borderRadius: '16px 16px 0 0',
                  zIndex: 1
                }
              }}>
                <Box sx={{
                  height: { xs: '200px', md: '210px' },
                  width: '100%',
                  backgroundImage: 'url(/assets/images/x008.png)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }} />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', p: { xs: 2, md: 3 } }}>
                  <Typography sx={{
                    fontFamily: '"Playfair Display", "Times New Roman", serif',
                    fontWeight: 700,
                    color: '#b98f33',
                    fontSize: { xs: '1.2rem', md: '1.3rem' },
                    mb: 1.5,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    20+ Experts
                  </Typography>
                  <Typography sx={{
                    fontFamily: '"Inter", sans-serif',
                    color: '#666666',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    lineHeight: 1.6,
                    textAlign: 'center'
                  }}>
                    Fabric Specialists & Craftspeople
                  </Typography>
                </CardContent>
              </Card>

              {/* Card 3 - Quote Card */}
              <Card sx={{
                flex: { xs: '0 0 auto', md: '1 1 0' },
                width: { xs: '100%', md: 'auto' },
                height: { xs: 'auto', md: '350px' },
                background: 'linear-gradient(135deg, #d4af5a 0%, #b98f33 50%, #8b6b1f 100%)',
                borderRadius: '16px',
                padding: { xs: 3, md: 4 },
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(185, 143, 51, 0.1)',
                border: '2px solid rgba(185, 143, 51, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 6px 16px rgba(185, 143, 51, 0.15)',
                  border: '2px solid rgba(185, 143, 51, 0.3)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 50%, #b98f33 100%)',
                  borderRadius: '16px 16px 0 0'
                }
              }}>
                <Typography sx={{
                  fontFamily: '"Playfair Display", "Times New Roman", serif',
                  fontWeight: 700,
                  color: '#000000',
                  fontSize: { xs: '1.1rem', md: '1.25rem' },
                  lineHeight: 1.4,
                  textAlign: 'center',
                  px: { xs: 2, md: 3 }
                }}>
                  We believe everyone has the right to a well-furnished life
                </Typography>
              </Card>

              {/* Card 4 - Left (with image) */}
              <Card sx={{
                flex: { xs: '0 0 auto', md: '1 1 0' },
                width: { xs: '100%', md: 'auto' },
                height: { xs: 'auto', md: '350px' },
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(185, 143, 51, 0.1)',
                border: '2px solid rgba(185, 143, 51, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 6px 16px rgba(185, 143, 51, 0.15)',
                  border: '2px solid rgba(185, 143, 51, 0.3)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 50%, #b98f33 100%)',
                  borderRadius: '16px 16px 0 0',
                  zIndex: 1
                }
              }}>
                <Box sx={{
                  height: { xs: '200px', md: '210px' },
                  width: '100%',
                  backgroundImage: 'url(/assets/images/x009.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }} />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', p: { xs: 2, md: 3 } }}>
                  <Typography sx={{
                    fontFamily: '"Playfair Display", "Times New Roman", serif',
                    fontWeight: 700,
                    color: '#b98f33',
                    fontSize: { xs: '1.2rem', md: '1.3rem' },
                    mb: 1.5,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    Custom Design
                  </Typography>
                  <Typography sx={{
                    fontFamily: '"Inter", sans-serif',
                    color: '#666666',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    lineHeight: 1.6,
                    textAlign: 'center'
                  }}>
                    Tailored to Your Unique Vision
                  </Typography>
                </CardContent>
              </Card>

              {/* Card 5 - Right (with image) */}
              <Card sx={{
                flex: { xs: '0 0 auto', md: '1 1 0' },
                width: { xs: '100%', md: 'auto' },
                height: { xs: 'auto', md: '350px' },
                backgroundColor: '#ffffff',
                borderRadius: '16px',
                padding: 0,
                boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(185, 143, 51, 0.1)',
                border: '2px solid rgba(185, 143, 51, 0.15)',
                position: 'relative',
                overflow: 'hidden',
                transition: 'all 0.3s ease-in-out',
                display: 'flex',
                flexDirection: 'column',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 6px 16px rgba(185, 143, 51, 0.15)',
                  border: '2px solid rgba(185, 143, 51, 0.3)'
                },
                '&::before': {
                  content: '""',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 50%, #b98f33 100%)',
                  borderRadius: '16px 16px 0 0',
                  zIndex: 1
                }
              }}>
                <Box sx={{
                  height: { xs: '200px', md: '210px' },
                  width: '100%',
                  backgroundImage: 'url(/assets/images/x010.jpg)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  position: 'relative'
                }} />
                <CardContent sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', p: { xs: 2, md: 3 } }}>
                  <Typography sx={{
                    fontFamily: '"Playfair Display", "Times New Roman", serif',
                    fontWeight: 700,
                    color: '#b98f33',
                    fontSize: { xs: '1.2rem', md: '1.3rem' },
                    mb: 1.5,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    Quality Promise
                  </Typography>
                  <Typography sx={{
                    fontFamily: '"Inter", sans-serif',
                    color: '#666666',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    lineHeight: 1.6,
                    textAlign: 'center'
                  }}>
                    Premium Materials & Craftsmanship
                  </Typography>
                </CardContent>
              </Card>
            </Box>
          </Container>
        </Box>

        {/* About Section */}
        <Box sx={{ 
          backgroundColor: '#f8f8f8',
          py: { xs: 6, md: 8 }
        }}>
          <Container maxWidth="lg">
            <Box sx={{
              display: 'flex',
              flexDirection: { xs: 'column', md: 'row' },
              gap: { xs: 3, md: 4 },
              alignItems: 'stretch'
            }}>
              {/* Left Column - Text Content - 50% width */}
              <Box sx={{
                flex: { xs: '0 0 auto', md: '0 0 50%' },
                width: { xs: '100%', md: '50%' },
                maxWidth: { xs: '100%', md: '50%' },
                pr: { xs: 0, md: 2 }
              }}>
                {/* Decorative Line Above */}
                <Box sx={{
                  width: '80px',
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33, #d4af5a, #8b6b1f)',
                  mb: 3,
                  borderRadius: '2px'
                }} />
                
                <Typography 
                  variant="h2" 
                  sx={{ 
                    fontFamily: '"Playfair Display", "Times New Roman", serif',
                    fontWeight: 700,
                    color: '#333333',
                    fontSize: { xs: '2rem', md: '3rem' },
                    letterSpacing: '-0.02em',
                    lineHeight: 1.2,
                    mb: 1.5,
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  JL Upholstery
                </Typography>
                
                <Typography 
                  variant="h6" 
                  sx={{ 
                    fontFamily: '"Inter", "Roboto", sans-serif',
                    color: '#b98f33',
                    fontSize: { xs: '0.9rem', md: '1.1rem' },
                    fontWeight: 500,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    mb: 3,
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  Since 1993 • Milton, Ontario
                </Typography>
                
                <Typography 
                  variant="body1" 
                  paragraph 
                  sx={{ 
                    lineHeight: 1.8,
                    color: '#444444',
                    fontSize: { xs: '1rem', md: '1.1rem' },
                    fontWeight: 400,
                    mb: 2.5,
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  We're JL Upholstery, a family owned and run custom upholstery company with over 30 years of experience, located in Milton, Ontario. Our journey began with a simple belief: that every piece of furniture has a story worth preserving.
                </Typography>
                
                <Typography 
                  variant="body1" 
                  paragraph 
                  sx={{ 
                    lineHeight: 1.8,
                    color: '#444444',
                    fontSize: { xs: '1rem', md: '1.1rem' },
                    fontWeight: 400,
                    textAlign: { xs: 'center', md: 'left' }
                  }}
                >
                  We all have memories and stories that are tied to our favorite pieces of furniture so we have been inspired by the ways in which furniture can affect our lives.
                </Typography>
              </Box>
              
              {/* Right Column - Image - 50% width */}
              <Box sx={{
                flex: { xs: '0 0 auto', md: '0 0 50%' },
                width: { xs: '100%', md: '50%' },
                maxWidth: { xs: '100%', md: '50%' },
                pl: { xs: 0, md: 2 }
              }}>
                <Card sx={{
                  height: { xs: '350px', md: '450px' },
                  width: '100%',
                  borderRadius: '16px',
                  overflow: 'hidden',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.08), 0 4px 12px rgba(185, 143, 51, 0.1)',
                  border: '2px solid rgba(185, 143, 51, 0.15)',
                  position: 'relative',
                  transition: 'all 0.3s ease-in-out',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 32px rgba(0,0,0,0.12), 0 6px 16px rgba(185, 143, 51, 0.15)',
                    border: '2px solid rgba(185, 143, 51, 0.3)'
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    height: '3px',
                    background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 50%, #b98f33 100%)',
                    borderRadius: '16px 16px 0 0',
                    zIndex: 1
                  }
                }}>
                  <Box 
                    sx={{
                      width: '100%',
                      height: '100%',
                      backgroundImage: 'url(/assets/images/x005.png)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }} 
                  />
                </Card>
              </Box>
            </Box>
          </Container>
        </Box>
 
                 {/* Why Us Section */}
         <Box 
           id="why-us-section"
           sx={{ 
             backgroundColor: '#ffffff',
             py: { xs: 8, md: 12 }
           }}
         >
           <Container maxWidth="lg">
                           <Box sx={{ textAlign: 'center', mb: 8, position: 'relative' }}>
                {/* Decorative Line Above */}
                <Box sx={{
                  width: '80px',
                  height: '3px',
                  background: 'linear-gradient(90deg, #b98f33, #d4af5a, #8b6b1f)',
                  margin: '0 auto 20px',
                  borderRadius: '2px',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-8px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '16px',
                    height: '16px',
                    background: '#b98f33',
                    borderRadius: '50%',
                    border: '3px solid #ffffff',
                    boxShadow: '0 0 0 2px #b98f33'
                  }
                }} />
                
                <Typography variant="h3" component="h2" gutterBottom sx={{ 
                  fontFamily: '"Playfair Display", "Times New Roman", serif',
                  fontWeight: 700, 
                  color: '#333333',
                  fontSize: { xs: '2.5rem', md: '3rem', lg: '3.5rem' },
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  position: 'relative',
                  mb: 3,
                  textTransform: 'uppercase',
                  opacity: whyUsAnimations.titleVisible ? 1 : 0,
                  transform: whyUsAnimations.titleVisible ? 'translateY(0) scale(1)' : 'translateY(50px) scale(0.8)',
                  transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  animation: whyUsAnimations.titleVisible ? 'titleBounce 1.2s ease-out' : 'none',
                  '@keyframes titleBounce': {
                    '0%': {
                      transform: 'translateY(50px) scale(0.8)',
                      opacity: 0
                    },
                    '50%': {
                      transform: 'translateY(-10px) scale(1.05)',
                      opacity: 1
                    },
                    '100%': {
                      transform: 'translateY(0) scale(1)',
                      opacity: 1
                    }
                  },
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-15px',
                    left: '-30px',
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, rgba(185, 143, 51, 0.1) 0%, rgba(185, 143, 51, 0.05) 100%)',
                    borderRadius: '50%',
                    zIndex: -1,
                    animation: whyUsAnimations.titleVisible ? 'pulseGlow 2s ease-in-out infinite' : 'none',
                    '@keyframes pulseGlow': {
                      '0%, 100%': {
                        transform: 'scale(1)',
                        opacity: 0.3
                      },
                      '50%': {
                        transform: 'scale(1.2)',
                        opacity: 0.6
                      }
                    }
                  },
                  '&::after': {
                    content: '""',
                    position: 'absolute',
                    top: '-15px',
                    right: '-30px',
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, rgba(185, 143, 51, 0.1) 0%, rgba(185, 143, 51, 0.05) 100%)',
                    borderRadius: '50%',
                    zIndex: -1,
                    animation: whyUsAnimations.titleVisible ? 'pulseGlow 2s ease-in-out infinite 0.5s' : 'none'
                  }
                }}>
                  Why Us
                </Typography>
                
                {/* Decorative Line Below */}
                <Box sx={{
                  width: '120px',
                  height: '2px',
                  background: 'linear-gradient(90deg, transparent 0%, #b98f33 20%, #d4af5a 50%, #b98f33 80%, transparent 100%)',
                  margin: '0 auto',
                  borderRadius: '1px',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: 'translate(-50%, -50%)',
                    width: '8px',
                    height: '8px',
                    background: '#b98f33',
                    borderRadius: '50%',
                    boxShadow: '0 0 0 2px #ffffff, 0 0 0 4px #b98f33'
                  }
                }} />
                
                {/* Subtitle */}
                <Typography variant="h6" sx={{
                  fontFamily: '"Inter", sans-serif',
                  color: '#666666',
                  fontSize: { xs: '1rem', md: '1.1rem' },
                  fontWeight: 400,
                  mt: 2,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase'
                }}>
                  Discover What Sets Us Apart
                </Typography>
              </Box>

                                         <Box sx={{ 
                  display: 'flex',
                flexWrap: 'wrap', 
                gap: 3, 
                  justifyContent: 'center',
                alignItems: 'stretch'
              }}>
                {/* Aesthetically Pleasing */}
                <Box sx={{ 
                  flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)' },
                  minWidth: { md: '300px' },
                  maxWidth: { md: '400px' },
                  opacity: whyUsAnimations.cardsVisible[0] ? 1 : 0,
                  transform: whyUsAnimations.cardsVisible[0] ? 'translateY(0) scale(1) rotateY(0deg)' : 'translateY(100px) scale(0.5) rotateY(-90deg)',
                  transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                  animation: whyUsAnimations.cardsVisible[0] ? 'cardEntrance 1s ease-out' : 'none',
                  '@keyframes cardEntrance': {
                    '0%': {
                      transform: 'translateY(100px) scale(0.5) rotateY(-90deg)',
                      opacity: 0
                    },
                    '50%': {
                      transform: 'translateY(-20px) scale(1.1) rotateY(-45deg)',
                      opacity: 0.8
                    },
                    '100%': {
                      transform: 'translateY(0) scale(1) rotateY(0deg)',
                      opacity: 1
                    }
                  }
                }}>
                  <Card sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                    overflow: 'hidden',
                    backgroundColor: '#f8f8f8',
                    border: '2px solid #e0e0e0',
                    borderRadius: '20px',
                    transform: 'perspective(1000px)',
                    '&:hover': {
                      transform: 'translateY(-12px) scale(1.02) perspective(1000px) rotateX(5deg)',
                      boxShadow: '0 25px 50px rgba(185, 143, 51, 0.3), 0 0 30px rgba(185, 143, 51, 0.2)',
                      border: '2px solid #b98f33',
                      backgroundColor: '#ffffff'
                    }
                  }}>
                                       {/* Image */}
                    <Box sx={{ 
                      height: 200,
                      backgroundImage: 'url(/assets/images/x007.png)',
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        background: 'linear-gradient(135deg, rgba(185, 143, 51, 0.3) 0%, rgba(185, 143, 51, 0.1) 100%)'
                      }
                    }} />
                   
                   <CardContent sx={{ 
                     flexGrow: 1, 
                     textAlign: 'center', 
                     p: 4,
                     display: 'flex',
                     flexDirection: 'column',
                     justifyContent: 'center'
                   }}>
                     <Typography variant="h5" component="h3" sx={{ 
                       fontFamily: '"Playfair Display", "Times New Roman", serif',
                       fontWeight: 700,
                       color: '#333333',
                       mb: 2,
                       fontSize: '1.5rem'
                     }}>
                       Aesthetically Pleasing
                  </Typography>
                     <Typography variant="body1" sx={{ 
                       color: '#666666',
                       lineHeight: 1.6,
                       fontSize: '1.1rem'
                     }}>
                       Our products are functional, aesthetically pleasing and of high quality that suit your requirements.
                     </Typography>
                   </CardContent>
                 </Card>
                </Box>

               {/* Pocket-Friendly */}
               <Box sx={{ 
                 flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)' },
                 minWidth: { md: '300px' },
                 maxWidth: { md: '400px' },
                 opacity: whyUsAnimations.cardsVisible[1] ? 1 : 0,
                 transform: whyUsAnimations.cardsVisible[1] ? 'translateY(0) scale(1) rotateY(0deg)' : 'translateY(100px) scale(0.5) rotateY(-90deg)',
                 transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                 animation: whyUsAnimations.cardsVisible[1] ? 'cardEntrance 1s ease-out' : 'none'
               }}>
                 <Card sx={{ 
                   height: '100%',
                   display: 'flex',
                   flexDirection: 'column',
                   transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                   overflow: 'hidden',
                   backgroundColor: '#f8f8f8',
                   border: '2px solid #e0e0e0',
                   borderRadius: '20px',
                   transform: 'perspective(1000px)',
                   '&:hover': {
                     transform: 'translateY(-12px) scale(1.02) perspective(1000px) rotateX(5deg)',
                     boxShadow: '0 25px 50px rgba(185, 143, 51, 0.3), 0 0 30px rgba(185, 143, 51, 0.2)',
                     border: '2px solid #b98f33',
                     backgroundColor: '#ffffff'
                   }
                 }}>
                                     {/* Image */}
                   <Box sx={{ 
                     height: 200,
                     backgroundImage: 'url(/assets/images/x008.png)',
                     backgroundSize: 'cover',
                     backgroundPosition: 'center',
                     position: 'relative',
                     '&::before': {
                       content: '""',
                       position: 'absolute',
                       top: 0,
                       left: 0,
                       right: 0,
                       bottom: 0,
                       background: 'linear-gradient(135deg, rgba(185, 143, 51, 0.3) 0%, rgba(185, 143, 51, 0.1) 100%)'
                     }
                   }} />
                  
                  <CardContent sx={{ 
                    flexGrow: 1, 
                    textAlign: 'center', 
                    p: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center'
                  }}>
                    <Typography variant="h5" component="h3" sx={{ 
                      fontFamily: '"Playfair Display", "Times New Roman", serif',
                      fontWeight: 700,
                      color: '#333333',
                      mb: 2,
                      fontSize: '1.5rem'
                    }}>
                      Pocket-Friendly
                    </Typography>
                    <Typography variant="body1" sx={{ 
                      color: '#666666',
                      lineHeight: 1.6,
                      fontSize: '1.1rem'
                    }}>
                      From contemporary to traditional, we can help you find the right style at the price you can afford.
                    </Typography>
                  </CardContent>
                </Card>
              </Box>

              {/* Personalized Service */}
              <Box sx={{ 
                flex: { xs: '1 1 100%', sm: '1 1 calc(50% - 12px)', md: '1 1 calc(33.333% - 16px)' },
                minWidth: { md: '300px' },
                maxWidth: { md: '400px' },
                opacity: whyUsAnimations.cardsVisible[2] ? 1 : 0,
                transform: whyUsAnimations.cardsVisible[2] ? 'translateY(0) scale(1) rotateY(0deg)' : 'translateY(100px) scale(0.5) rotateY(-90deg)',
                transition: 'all 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)',
                animation: whyUsAnimations.cardsVisible[2] ? 'cardEntrance 1s ease-out' : 'none'
              }}>
                <Card sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                  overflow: 'hidden',
                  backgroundColor: '#f8f8f8',
                  border: '2px solid #e0e0e0',
                  borderRadius: '20px',
                  transform: 'perspective(1000px)',
                  '&:hover': {
                    transform: 'translateY(-12px) scale(1.02) perspective(1000px) rotateX(5deg)',
                    boxShadow: '0 25px 50px rgba(185, 143, 51, 0.3), 0 0 30px rgba(185, 143, 51, 0.2)',
                    border: '2px solid #b98f33',
                    backgroundColor: '#ffffff'
                  }
                }}>
                                   {/* Image */}
                  <Box sx={{ 
                    height: 200,
                    backgroundImage: 'url(/assets/images/x009.jpg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(135deg, rgba(185, 143, 51, 0.3) 0%, rgba(185, 143, 51, 0.1) 100%)'
                    }
                  }} />
                 
                 <CardContent sx={{ 
                   flexGrow: 1, 
                   textAlign: 'center', 
                   p: 4,
                   display: 'flex',
                   flexDirection: 'column',
                   justifyContent: 'center'
                 }}>
                   <Typography variant="h5" component="h3" sx={{ 
                     fontFamily: '"Playfair Display", "Times New Roman", serif',
                     fontWeight: 700,
                     color: '#333333',
                     mb: 2,
                     fontSize: '1.5rem'
                   }}>
                     Personalized Service
                   </Typography>
                   <Typography variant="body1" sx={{ 
                     color: '#666666',
                     lineHeight: 1.6,
                     fontSize: '1.1rem'
                   }}>
                     Our personalized solutions and attention to detail are the cornerstones of our company.
                   </Typography>
                 </CardContent>
               </Card>
             </Box>
           </Box>
        </Container>
      </Box>

      {/* Services Section */}
      <Box sx={{ backgroundColor: '#f8f8f8' }}>
        <Container maxWidth="xl" sx={{ py: { xs: 6, md: 8 } }}>
        <Box sx={{ textAlign: 'center', mb: 6 }}>
                         <Typography variant="h3" component="h2" gutterBottom sx={{ 
               fontFamily: '"Playfair Display", "Times New Roman", serif',
               fontWeight: 700, 
               color: '#333333',
               fontSize: { xs: '2rem', md: '2.5rem' },
               letterSpacing: '-0.01em',
               lineHeight: 1.2
             }}>
               Our Upholstery Services
          </Typography>
            <Typography variant="h6" sx={{ maxWidth: 600, mx: 'auto', color: '#666666' }}>
              From indoor comfort to outdoor durability, we bring new life to your furniture with expert craftsmanship and premium materials.
          </Typography>
        </Box>

          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 3, justifyContent: 'center' }}>
          {services.map((service, index) => (
              <Box key={index} sx={{ 
                width: { xs: '100%', sm: 'calc(50% - 12px)', md: 'calc(33.333% - 16px)' },
                minWidth: { md: '300px' },
                maxWidth: { md: '400px' }
              }}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'transform 0.3s ease-in-out, box-shadow 0.3s ease-in-out',
                    overflow: 'hidden',
                    backgroundColor: '#f8f8f8 !important',
                    border: '1px solid #e0e0e0',
                    maxWidth: '100%',
                    '& .MuiCardContent-root': {
                      backgroundColor: '#f8f8f8 !important'
                    },
                  '&:hover': {
                    transform: 'translateY(-8px)',
                      boxShadow: '0 8px 25px rgba(0,0,0,0.15)',
                      border: '2px solid #b98f33',
                      backgroundColor: '#f8f8f8 !important',
                      '& .service-image': {
                        transform: 'scale(1.05)'
                      }
                    }
                  }}
                >
                                    <Box sx={{ position: 'relative', height: 200, overflow: 'hidden' }}>
                    <Box
                      className="service-image"
                      sx={{
                        width: '100%',
                        height: '100%',
                        backgroundImage: `url(${service.image})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        transition: 'transform 0.3s ease-in-out'
                      }}
                    />
                    
                  </Box>
                  
                  {/* Title Banner */}
                  <Box sx={{ 
                    background: 'linear-gradient(135deg, #1a1a1a 0%, #000000 50%, #1a1a1a 100%)',
                    py: 2, 
                    px: 3,
                    borderTop: '2px solid #b98f33',
                    borderBottom: '2px solid #b98f33',
                    position: 'relative',
                    '&::before': {
                      content: '""',
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      right: 0,
                      height: '1px',
                      background: 'linear-gradient(90deg, transparent 0%, rgba(185, 143, 51, 0.6) 50%, transparent 100%)'
                    },
                    '&::after': {
                      content: '""',
                      position: 'absolute',
                      top: '1px',
                      left: 0,
                      right: 0,
                      bottom: 0,
                      background: 'linear-gradient(180deg, rgba(255, 255, 255, 0.05) 0%, transparent 50%, rgba(0, 0, 0, 0.3) 100%)'
                    }
                  }}>
                                         <Typography variant="h5" component="h3" sx={{ 
                       fontFamily: '"Playfair Display", "Times New Roman", serif',
                       fontWeight: 700, 
                       color: '#b98f33', 
                       mb: 0.5, 
                       wordWrap: 'break-word',
                       textAlign: 'center',
                       fontSize: '1.25rem',
                       textShadow: '0 2px 4px rgba(0,0,0,0.8), 0 1px 2px rgba(185, 143, 51, 0.3)',
                       position: 'relative',
                       zIndex: 1,
                       letterSpacing: '-0.01em',
                       lineHeight: 1.1
                     }}>
                    {service.title}
                  </Typography>
                    <Typography variant="body2" sx={{ 
                      fontWeight: 500, 
                      color: '#d4af5a', 
                      wordWrap: 'break-word',
                      textAlign: 'center',
                      fontSize: '0.875rem',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      textShadow: '0 1px 2px rgba(0,0,0,0.6)',
                      position: 'relative',
                      zIndex: 1
                    }}>
                      {service.subtitle}
                    </Typography>
                  </Box>
                  
                                     <CardContent sx={{ flexGrow: 1, textAlign: 'center', py: 3, backgroundColor: '#f8f8f8', maxWidth: '100%', overflow: 'hidden' }}>
                     <Typography variant="body1" sx={{ lineHeight: 1.6, color: '#666666', wordWrap: 'break-word', mb: 3 }}>
                    {service.description}
                  </Typography>
                     <Button
                       component={RouterLink}
                       to="/services"
                       variant="contained"
                       size="medium"
                       sx={{
                         ...buttonStyles.homePageButton,
                         fontSize: '0.9rem',
                         padding: '12px 28px',
                         minWidth: 'auto'
                       }}
                     >
                       Explore Our Innovative Solutions
                     </Button>
                </CardContent>
              </Card>
               </Box>
          ))}
           </Box>
      </Container>
      </Box>

             {/* Partners Section */}
        <Box sx={{ 
          backgroundColor: '#f8f8f8',
          py: { xs: 8, md: 12 }
        }}>
          <Container maxWidth="lg">
            {/* Updated Partners Layout */}
            <Box sx={{ 
              position: 'relative',
              minHeight: { xs: '600px', md: '700px' },
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4
            }}>
              {/* Top Row - 6 Larger Partner Logos */}
              <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 4,
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                maxWidth: '1200px'
              }}>
                {['b001.jpg', 'b002.jpg', 'b003.jpg', 'b004.jpg', 'b005.jpg', 'b006.jpg'].map((image, index) => (
                  <Card key={index} sx={{
                    width: { xs: '100px', sm: '120px', md: '140px' },
                    height: { xs: '100px', sm: '120px', md: '140px' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#ffffff',
                    border: '2px solid #e0e0e0',
                    borderRadius: '15px',
                    transition: 'all 0.4s ease-in-out',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
                    '&:hover': {
                      transform: 'translateY(-6px) scale(1.03)',
                      boxShadow: '0 15px 30px rgba(185, 143, 51, 0.25)',
                      border: '2px solid #b98f33',
                      '& .partner-logo': {
                        filter: 'grayscale(0%) brightness(1.1) contrast(1.1)'
                      }
                    }
                  }}>
                    <Box
                      className="partner-logo"
        sx={{
                        width: '75%',
                        height: '75%',
                        backgroundImage: `url(/assets/images/${image})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        filter: 'grayscale(0%)',
                        transition: 'all 0.3s ease-in-out'
                      }}
                    />
                  </Card>
                ))}
              </Box>

                             {/* Central "Sun" Card - Rectangular */}
               <Box sx={{
                 zIndex: 10,
                 width: { xs: '280px', sm: '360px', md: '440px' },
                 height: { xs: '160px', sm: '180px', md: '200px' }
               }}>
                <Card sx={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(135deg, #b98f33 0%, #d4af5a 50%, #8b6b1f 100%)',
                  border: '3px solid #ffffff',
                  borderRadius: '20px',
                  boxShadow: '0 20px 40px rgba(185, 143, 51, 0.4), 0 0 0 1px rgba(255, 255, 255, 0.2)',
                  position: 'relative',
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-10px',
                    left: '-10px',
                    right: '-10px',
                    bottom: '-10px',
                    background: 'radial-gradient(circle, rgba(185, 143, 51, 0.2) 0%, transparent 70%)',
                    borderRadius: '25px',
                    zIndex: -1,
                    animation: 'pulse 3s ease-in-out infinite'
                  },
                  '@keyframes pulse': {
                    '0%, 100%': {
                      transform: 'scale(1)',
                      opacity: 0.6
                    },
                    '50%': {
                      transform: 'scale(1.1)',
                      opacity: 0.3
                    }
                  }
                }}>
                  <Typography variant="h3" sx={{ 
                    fontFamily: '"Playfair Display", "Times New Roman", serif',
                    fontWeight: 900,
                    color: '#ffffff',
                    fontSize: { xs: '1.8rem', md: '2.2rem' },
                    textAlign: 'center',
                    mb: 1,
                    textShadow: '0 2px 4px rgba(0,0,0,0.5)',
                    letterSpacing: '-0.02em'
                  }}>
                    Our Partners
            </Typography>
                  <Typography variant="h6" sx={{ 
                    fontFamily: '"Inter", sans-serif',
                    color: '#ffffff',
                    fontSize: { xs: '0.9rem', md: '1rem' },
                    textAlign: 'center',
                    fontWeight: 400,
                    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase'
                  }}>
                    Partners in Excellence
            </Typography>
                </Card>
              </Box>

              {/* Bottom Row - All Remaining Partner Logos */}
              <Box sx={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 3,
                justifyContent: 'center',
                alignItems: 'center',
                width: '100%',
                maxWidth: '1200px'
              }}>
                {['b007.jpg', 'b008.jpg', 'b009.jpg', 'b010.jpg', 'b011.jpg', 'b012.jpg', 'b013.jpg', 'b014.jpg', 'b015.jpg', 'b016.jpg', 'b017.jpg', 'b018.jpg', 'b019.jpg'].map((image, index) => (
                  <Card key={index} sx={{
                    width: { xs: '80px', sm: '100px', md: '120px' },
                    height: { xs: '80px', sm: '100px', md: '120px' },
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: '#ffffff',
                    border: '2px solid #e0e0e0',
                    borderRadius: '15px',
                    transition: 'all 0.4s ease-in-out',
                    cursor: 'pointer',
                    overflow: 'hidden',
                    boxShadow: '0 6px 12px rgba(0,0,0,0.1)',
                    '&:hover': {
                      transform: 'translateY(-6px) scale(1.03)',
                      boxShadow: '0 15px 30px rgba(185, 143, 51, 0.25)',
                      border: '2px solid #b98f33',
                      '& .partner-logo': {
                        filter: 'grayscale(0%) brightness(1.1) contrast(1.1)'
                      }
                    }
                  }}>
                    <Box
                      className="partner-logo"
              sx={{
                        width: '75%',
                        height: '75%',
                        backgroundImage: `url(/assets/images/${image})`,
                        backgroundSize: 'contain',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        filter: 'grayscale(0%)',
                        transition: 'all 0.3s ease-in-out'
                      }}
                    />
                  </Card>
                ))}
              </Box>
            </Box>
          </Container>
        </Box>

       

       
    </Box>
  );
};

export default HomePage;