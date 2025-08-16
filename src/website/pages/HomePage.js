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
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';

const HomePage = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [currentSlide, setCurrentSlide] = useState(0);
  const [activeReviewCard, setActiveReviewCard] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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
      setActiveReviewCard((prevCard) => (prevCard + 1) % 5);
    }, 3000); // Change card every 3 seconds

    return () => clearInterval(interval);
  }, [isPaused]);

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
          backgroundImage: 'url(/assets/images/x001.png)',
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
        <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={8}>
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
                   fontSize: { xs: '2.5rem', md: '3.5rem' }
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
                   opacity: 0.95,
                   lineHeight: 1.4,
                   textShadow: '1px 1px 2px rgba(0,0,0,0.7)',
                   fontWeight: 400,
                   color: '#ffffff',
                   fontSize: { xs: '1.25rem', md: '1.5rem' },
                   letterSpacing: '0.01em'
                 }}
               >
                 We believe everyone has the right to a well-furnished life
               </Typography>
              <Typography
                variant="body1"
                paragraph
                sx={{
                  mb: 4,
                  opacity: 0.9,
                  lineHeight: 1.8,
                  fontSize: '1.1rem',
                  textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
                  maxWidth: '600px',
                  color: '#ffffff'
                }}
              >
                At JL Upholstery, we believe everyone has the right to a well-furnished life. Our team of 20+ fabric experts and skilled upholsterers specializes in custom re-upholstery, combining creativity, passion, and expertise with your vision to give the furniture you love a second chance at life.
              </Typography>
              <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                <Button
                  component={RouterLink}
                  to="/services"
                  variant="contained"
                  size="large"
                  sx={{
                    backgroundColor: '#b98f33',
                    color: '#ffffff',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    border: '2px solid #8b6b1f',
                    boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
                    '&:hover': {
                      backgroundColor: '#d4af5a',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 6px 12px rgba(0,0,0,0.3)'
                    }
                  }}
                >
                  Explore Services
                </Button>
                <Button
                  component={RouterLink}
                  to="/contact"
                  variant="outlined"
                  size="large"
                  sx={{
                    borderColor: '#ffffff',
                    color: '#ffffff',
                    textTransform: 'none',
                    fontWeight: 600,
                    px: 4,
                    py: 1.5,
                    border: '2px solid',
                    '&:hover': {
                      borderColor: '#b98f33',
                      backgroundColor: '#b98f33',
                      transform: 'translateY(-2px)',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                    }
                  }}
                >
                  Contact Us
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Container>
             </Box>
 
               {/* Quote Section */}
        <Box sx={{ 
          py: { xs: 8, md: 12 },
          backgroundColor: '#f8f8f8'
        }}>
                     <Container maxWidth="lg">
             <Box sx={{ textAlign: 'center', position: 'relative' }}>
                               {/* Left Quote Icon */}
                <Typography sx={{
                  position: 'absolute',
                  top: { xs: '-40px', md: '-60px' },
                  left: { xs: '10px', md: '20px' },
                  fontSize: { xs: '6rem', md: '10rem', lg: '12rem' },
                  color: '#b98f33',
                  opacity: 0.9,
                  zIndex: 1,
                  fontFamily: '"Playfair Display", "Times New Roman", serif',
                  fontWeight: 300,
                  lineHeight: 1,
                  transform: 'rotate(180deg)',
                  textShadow: '0 4px 8px rgba(0,0,0,0.1)'
                }}>
                  "
                </Typography>
                
                <Typography variant="h1" component="h2" sx={{ 
                  fontFamily: '"Playfair Display", "Times New Roman", serif',
                  fontWeight: 700, 
                  color: '#333333',
                  fontSize: { xs: '2.5rem', md: '3.5rem', lg: '4.5rem' },
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                  mb: 2,
                  px: { xs: 8, md: 12 },
                  position: 'relative',
                  zIndex: 2
                }}>
                  We believe everyone has the right to a well-furnished life
                </Typography>
                
                {/* Right Quote Icon */}
                <Typography sx={{
                  position: 'absolute',
                  bottom: { xs: '-40px', md: '-60px' },
                  right: { xs: '10px', md: '20px' },
                  fontSize: { xs: '6rem', md: '10rem', lg: '12rem' },
                  color: '#b98f33',
                  opacity: 0.9,
                  zIndex: 1,
                  fontFamily: '"Playfair Display", "Times New Roman", serif',
                  fontWeight: 300,
                  lineHeight: 1,
                  textShadow: '0 4px 8px rgba(0,0,0,0.1)'
                }}>
                  "
                </Typography>
             </Box>
           </Container>
        </Box>

        {/* About Section */}
        <Box sx={{ 
          backgroundImage: 'url(/assets/images/x005.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundAttachment: 'fixed',
          position: 'relative',
          py: { xs: 12, md: 16 },
          '&::before': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'linear-gradient(135deg, rgba(0, 0, 0, 0.6) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(0, 0, 0, 0.6) 100%)',
            zIndex: 1
          }
        }}>
                                <Container maxWidth="lg" sx={{ position: 'relative', zIndex: 2 }}>
                           <Box sx={{ 
                backgroundColor: 'rgba(255, 255, 255, 0.75)',
                backdropFilter: 'blur(15px)',
                borderRadius: '30px',
                boxShadow: '0 30px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(185, 143, 51, 0.1)',
                overflow: 'hidden',
                position: 'relative',
                p: { xs: 4, md: 6 },
               '&::before': {
                 content: '""',
                 position: 'absolute',
                 top: 0,
                 left: 0,
                 right: 0,
                 height: '6px',
                 background: 'linear-gradient(90deg, #b98f33 0%, #d4af5a 25%, #b98f33 50%, #d4af5a 75%, #b98f33 100%)'
               }
             }}>
               {/* Magazine Header */}
               <Box sx={{ 
                 textAlign: 'center', 
                 mb: { xs: 4, md: 6 },
                 borderBottom: '3px solid #b98f33',
                 pb: 3
               }}>
                 <Typography variant="h1" sx={{ 
                   fontFamily: '"Playfair Display", "Times New Roman", serif',
                   fontWeight: 900,
                   color: '#b98f33',
                   fontSize: { xs: '2.5rem', md: '4rem', lg: '5rem' },
                   letterSpacing: '-0.03em',
                   lineHeight: 0.9,
                   mb: 2,
                   textTransform: 'uppercase'
                 }}>
                   JL Upholstery
                 </Typography>
                 <Typography variant="h6" sx={{ 
                   fontFamily: '"Inter", "Roboto", sans-serif',
                   color: '#666666',
                   fontSize: { xs: '1rem', md: '1.2rem' },
                   fontWeight: 400,
                   letterSpacing: '0.1em',
                   textTransform: 'uppercase'
                 }}>
                   Since 1993 • Milton, Ontario
                 </Typography>
               </Box>

               {/* Magazine Content Grid */}
               <Grid container spacing={4}>
                 {/* Left Column - Main Story */}
                 <Grid item xs={12} md={8}>
                   <Typography variant="h2" sx={{ 
                     fontFamily: '"Playfair Display", "Times New Roman", serif',
                     fontWeight: 700,
                     color: '#333333',
                     fontSize: { xs: '1.8rem', md: '2.5rem' },
                     lineHeight: 1.2,
                     mb: 3,
                     letterSpacing: '-0.02em'
                   }}>
                     A Family Legacy of Craftsmanship
                   </Typography>
                   
                   <Typography variant="body1" paragraph sx={{ 
                     lineHeight: 1.8,
                     color: '#444444',
                     fontSize: { xs: '1.1rem', md: '1.2rem' },
                     fontWeight: 400,
                     mb: 4
                   }}>
                     We're JL Upholstery, a family owned and run custom upholstery company with over 30 years of experience, located in Milton, Ontario. Our journey began with a simple belief: that every piece of furniture has a story worth preserving.
                   </Typography>

                   <Typography variant="body1" paragraph sx={{ 
                     lineHeight: 1.8,
                     color: '#444444',
                     fontSize: { xs: '1.1rem', md: '1.2rem' },
                     fontWeight: 400,
                     mb: 4
                   }}>
                     We all have memories and stories that are tied to our favorite pieces of furniture so we have been inspired by the ways in which furniture can affect our lives. From the sofa where families gather to the chair that witnessed countless conversations, these pieces become part of our personal history.
                   </Typography>
                 </Grid>

                 {/* Right Column - Pull Quote & Sidebar */}
                 <Grid item xs={12} md={4}>
                   {/* Pull Quote */}
                   <Box sx={{ 
                     backgroundColor: '#f8f8f8',
                     borderLeft: '4px solid #b98f33',
                     p: 3,
                     mb: 4,
                     borderRadius: '0 15px 15px 0',
                     position: 'relative',
                     '&::before': {
                       content: '"""',
                       position: 'absolute',
                       top: '-10px',
                       left: '15px',
                       fontSize: '3rem',
                       color: '#b98f33',
                       fontFamily: '"Playfair Display", "Times New Roman", serif',
                       fontWeight: 300
                     }
                   }}>
                     <Typography variant="h5" sx={{ 
                       fontFamily: '"Playfair Display", "Times New Roman", serif',
                       fontWeight: 600,
                       color: '#b98f33',
                       fontSize: { xs: '1.2rem', md: '1.4rem' },
                       lineHeight: 1.3,
                       fontStyle: 'italic',
                       pl: 2
                     }}>
                       "Every piece of furniture is as unique as the person who requests it"
                     </Typography>
                   </Box>

                   {/* Sidebar Content */}
                   <Box sx={{ 
                     backgroundColor: '#f8f8f8',
                     p: 3,
                     borderRadius: '15px',
                     border: '2px solid #e0e0e0'
                   }}>
                     <Typography variant="h6" sx={{ 
                       fontFamily: '"Playfair Display", "Times New Roman", serif',
                       fontWeight: 700,
                       color: '#333333',
                       fontSize: '1.1rem',
                       mb: 2,
                       textAlign: 'center'
                     }}>
                       Our Commitment
                     </Typography>
                     <Typography variant="body2" sx={{ 
                       lineHeight: 1.6,
                       color: '#555555',
                       fontSize: '0.95rem',
                       textAlign: 'center'
                     }}>
                       We're proud of our hand craft. We will always work with you to find a perfect solution. Our goal is to give outstanding service and have happy returning customers. We ensure the best customer service experience for all our clients.
                     </Typography>
                   </Box>
                 </Grid>
               </Grid>

               {/* Magazine Footer */}
               <Box sx={{ 
                 textAlign: 'center', 
                 mt: { xs: 4, md: 6 },
                 pt: 3,
                 borderTop: '2px solid #e0e0e0'
               }}>
                 <Typography variant="body2" sx={{ 
                   color: '#888888',
                   fontSize: '0.9rem',
                   fontStyle: 'italic'
                 }}>
                   Crafting comfort, preserving memories, one piece at a time
                 </Typography>
               </Box>
             </Box>
           </Container>
                 </Box>
 
                 {/* Why Us Section */}
         <Box sx={{ 
           backgroundColor: '#ffffff',
           py: { xs: 8, md: 12 }
         }}>
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
                  '&::before': {
                    content: '""',
                    position: 'absolute',
                    top: '-15px',
                    left: '-30px',
                    width: '60px',
                    height: '60px',
                    background: 'linear-gradient(135deg, rgba(185, 143, 51, 0.1) 0%, rgba(185, 143, 51, 0.05) 100%)',
                    borderRadius: '50%',
                    zIndex: -1
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
                    zIndex: -1
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
                  maxWidth: { md: '400px' }
                }}>
                  <Card sx={{ 
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'all 0.3s ease-in-out',
                    overflow: 'hidden',
                    backgroundColor: '#f8f8f8',
                    border: '2px solid #e0e0e0',
                    borderRadius: '20px',
                    '&:hover': {
                      transform: 'translateY(-8px)',
                      boxShadow: '0 15px 30px rgba(185, 143, 51, 0.2)',
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
                 maxWidth: { md: '400px' }
               }}>
                 <Card sx={{ 
                   height: '100%',
                   display: 'flex',
                   flexDirection: 'column',
                   transition: 'all 0.3s ease-in-out',
                   overflow: 'hidden',
                   backgroundColor: '#f8f8f8',
                   border: '2px solid #e0e0e0',
                   borderRadius: '20px',
                   '&:hover': {
                     transform: 'translateY(-8px)',
                     boxShadow: '0 15px 30px rgba(185, 143, 51, 0.2)',
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
                maxWidth: { md: '400px' }
              }}>
                <Card sx={{ 
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  transition: 'all 0.3s ease-in-out',
                  overflow: 'hidden',
                  backgroundColor: '#f8f8f8',
                  border: '2px solid #e0e0e0',
                  borderRadius: '20px',
                  '&:hover': {
                    transform: 'translateY(-8px)',
                    boxShadow: '0 15px 30px rgba(185, 143, 51, 0.2)',
                    border: '2px solid #b98f33',
                    backgroundColor: '#ffffff'
                  }
                }}>
                                   {/* Image */}
                  <Box sx={{ 
                    height: 200,
                    backgroundImage: 'url(/assets/images/x009.png)',
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
                         backgroundColor: '#b98f33',
                         color: '#ffffff',
                         textTransform: 'none',
                         fontWeight: 600,
                         px: 3,
                         py: 1,
                         border: '2px solid #8b6b1f',
                         boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                         '&:hover': {
                           backgroundColor: '#d4af5a',
                           transform: 'translateY(-1px)',
                           boxShadow: '0 4px 8px rgba(0,0,0,0.2)'
                         }
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
