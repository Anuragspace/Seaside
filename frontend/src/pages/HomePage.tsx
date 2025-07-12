import React from 'react';
import Layout from '../components/Layout';
import Hero from '../components/Hero';

const HomePage: React.FC = () => {
  return (
    <Layout showNavbar={false}>
      <Hero />
    </Layout>
  );
};

export default HomePage;