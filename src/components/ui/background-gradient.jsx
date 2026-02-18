import React from 'react';
import { motion } from 'motion/react';
import './background-gradient.css';

function joinClassNames(...values) {
  return values.filter(Boolean).join(' ');
}

export function BackgroundGradient({
  children,
  className = '',
  containerClassName = '',
  animate = true,
}) {
  const variants = {
    initial: {
      backgroundPosition: '0 50%',
    },
    animate: {
      backgroundPosition: ['0 50%', '100% 50%', '0 50%'],
    },
  };

  return (
    <div className={joinClassNames('bg-gradient-container', containerClassName)}>
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? 'initial' : undefined}
        animate={animate ? 'animate' : undefined}
        transition={
          animate
            ? {
                duration: 6,
                repeat: Infinity,
                repeatType: 'reverse',
              }
            : undefined
        }
        style={{
          backgroundSize: animate ? '240% 240%' : undefined,
        }}
        className="bg-gradient-layer bg-gradient-layer-blur"
      />
      <motion.div
        variants={animate ? variants : undefined}
        initial={animate ? 'initial' : undefined}
        animate={animate ? 'animate' : undefined}
        transition={
          animate
            ? {
                duration: 6,
                repeat: Infinity,
                repeatType: 'reverse',
              }
            : undefined
        }
        style={{
          backgroundSize: animate ? '240% 240%' : undefined,
        }}
        className="bg-gradient-layer bg-gradient-layer-core"
      />
      <div className={joinClassNames('bg-gradient-content', className)}>{children}</div>
    </div>
  );
}
