'use client';

import React, {
  createContext,
  useContext,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useSpring,
  useTransform,
} from 'motion/react';
import '../../styles/dock.css';

/**
 * Dock (Motion-Primitives style API), adapted for AI Square.
 *
 * macOS-style magnification dock: items grow as the cursor approaches,
 * shrink as it moves away, and a label floats up over the hovered item.
 *
 *  - <Dock magnification={80} distance={150} panelHeight={64} springOptions>
 *  - <DockItem onClick>   (magnifies; provides hover identity)
 *  - <DockLabel>          (shows while its item is hovered)
 *  - <DockIcon>           (scales gently with its item)
 */

const DockContext = createContext(null);
const DockItemContext = createContext(null);

const DEFAULT_SPRING = { mass: 0.1, stiffness: 150, damping: 12 };

export function Dock({
  children,
  className = '',
  springOptions,
  magnification = 80,
  distance = 150,
  panelHeight = 64,
  ...props
}) {
  const mouseX = useMotionValue(Infinity);
  const [hovered, setHovered] = useState(null);

  const contextValue = useMemo(
    () => ({
      mouseX,
      hovered,
      setHovered,
      magnification,
      distance,
      panelHeight,
      springOptions: springOptions || DEFAULT_SPRING,
    }),
    [mouseX, hovered, magnification, distance, panelHeight, springOptions]
  );

  return (
    <DockContext.Provider value={contextValue}>
      <motion.div
        className={`mp-dock ${className}`.trim()}
        style={{ height: panelHeight }}
        onMouseMove={(e) => mouseX.set(e.pageX)}
        onMouseLeave={() => {
          mouseX.set(Infinity);
          setHovered(null);
        }}
        role="toolbar"
        aria-label="Dock"
        {...props}
      >
        {children}
      </motion.div>
    </DockContext.Provider>
  );
}

export function DockItem({ children, className = '', onClick, ...props }) {
  const dock = useContext(DockContext);
  if (!dock) throw new Error('DockItem must be used inside <Dock>.');

  const id = useId();
  const ref = useRef(null);
  const { mouseX, magnification, distance, panelHeight, springOptions, setHovered } = dock;

  const baseSize = Math.max(28, panelHeight - 16);

  const mouseDistance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - bounds.x - bounds.width / 2;
  });

  const widthSync = useTransform(mouseDistance, [-distance, 0, distance], [baseSize, magnification, baseSize]);
  const width = useSpring(widthSync, springOptions);

  const itemContext = useMemo(() => ({ id, width }), [id, width]);

  return (
    <DockItemContext.Provider value={itemContext}>
      <motion.div
        ref={ref}
        className={`mp-dock-item ${className}`.trim()}
        style={{ width, height: width }}
        onClick={onClick}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        role={onClick ? 'button' : undefined}
        {...props}
      >
        {children}
      </motion.div>
    </DockItemContext.Provider>
  );
}

export function DockLabel({ children, className = '', ...props }) {
  const dock = useContext(DockContext);
  const item = useContext(DockItemContext);
  if (!dock || !item) throw new Error('DockLabel must be used inside <DockItem>.');

  const isHovered = dock.hovered === item.id;

  return (
    <AnimatePresence>
      {isHovered && (
        <motion.div
          className={`mp-dock-label ${className}`.trim()}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: -8 }}
          exit={{ opacity: 0, y: 4 }}
          transition={{ duration: 0.18 }}
          role="tooltip"
          {...props}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function DockIcon({ children, className = '', ...props }) {
  const item = useContext(DockItemContext);
  if (!item) throw new Error('DockIcon must be used inside <DockItem>.');

  const { width } = item;
  // Icon eases between ~55% of the (magnifying) tile size.
  const iconWidth = useTransform(width, (w) => Math.max(16, w * 0.55));
  const iconSize = useSpring(iconWidth, { mass: 0.1, stiffness: 150, damping: 12 });

  return (
    <motion.div
      className={`mp-dock-icon ${className}`.trim()}
      style={{ width: iconSize, height: iconSize }}
      {...props}
    >
      {children}
    </motion.div>
  );
}

export default Dock;
