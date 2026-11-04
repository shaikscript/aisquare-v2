'use client';

import React, { createContext, useContext, useCallback, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import '../../styles/accordion-primitives.css';

/**
 * Accordion (Motion-Primitives style API), adapted for AI Square.
 *
 * Supports:
 *  - <Accordion transition variants expandedValue | defaultValue onValueChange allowMultiple>
 *  - <AccordionItem value>
 *  - <AccordionTrigger>  (renders a <button>, exposes data-expanded + .group)
 *  - <AccordionContent>  (spring height + variants animation)
 *
 * The Tailwind-style utility classes used by consumers of this component are
 * provided (scoped under .mp-accordion) by src/styles/accordion-primitives.css,
 * so no global Tailwind setup is required and existing site styles are untouched.
 */

const AccordionContext = createContext(null);
const AccordionItemContext = createContext(null);

function toValueArray(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

export function Accordion({
  children,
  className = '',
  transition,
  variants,
  expandedValue,
  defaultValue,
  onValueChange,
  allowMultiple = false,
  ...props
}) {
  const isControlled = expandedValue !== undefined;
  const [internalValue, setInternalValue] = useState(() => toValueArray(defaultValue));
  const expanded = isControlled ? toValueArray(expandedValue) : internalValue;

  const toggleItem = useCallback(
    (itemValue) => {
      const isOpen = expanded.includes(itemValue);
      let next;
      if (isOpen) {
        next = expanded.filter((v) => v !== itemValue);
      } else if (allowMultiple) {
        next = [...expanded, itemValue];
      } else {
        next = [itemValue];
      }
      if (!isControlled) setInternalValue(next);
      onValueChange?.(allowMultiple ? next : (next[0] ?? null));
    },
    [allowMultiple, expanded, isControlled, onValueChange]
  );

  const contextValue = useMemo(
    () => ({ expanded, toggleItem, transition, variants }),
    [expanded, toggleItem, transition, variants]
  );

  return (
    <AccordionContext.Provider value={contextValue}>
      <div className={`mp-accordion ${className}`.trim()} {...props}>
        {children}
      </div>
    </AccordionContext.Provider>
  );
}

export function AccordionItem({ children, value, className = '', ...props }) {
  const accordion = useContext(AccordionContext);
  if (!accordion) throw new Error('AccordionItem must be used inside <Accordion>.');

  const isExpanded = accordion.expanded.includes(value);
  const itemContext = useMemo(
    () => ({ value, isExpanded, toggle: () => accordion.toggleItem(value) }),
    [accordion, isExpanded, value]
  );

  return (
    <AccordionItemContext.Provider value={itemContext}>
      <div
        className={`mp-accordion-item ${className}`.trim()}
        data-expanded={isExpanded}
        {...props}
      >
        {children}
      </div>
    </AccordionItemContext.Provider>
  );
}

export function AccordionTrigger({ children, className = '', ...props }) {
  const item = useContext(AccordionItemContext);
  if (!item) throw new Error('AccordionTrigger must be used inside <AccordionItem>.');

  return (
    <motion.button
      type="button"
      className={`group mp-accordion-trigger ${className}`.trim()}
      data-expanded={item.isExpanded}
      aria-expanded={item.isExpanded}
      onClick={item.toggle}
      {...props}
    >
      {children}
    </motion.button>
  );
}

export function AccordionContent({ children, className = '', ...props }) {
  const item = useContext(AccordionItemContext);
  const accordion = useContext(AccordionContext);
  if (!item || !accordion) throw new Error('AccordionContent must be used inside <AccordionItem>.');

  const { transition, variants } = accordion;

  return (
    <AnimatePresence initial={false}>
      {item.isExpanded && (
        <motion.div
          key="content"
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={transition}
          style={{ overflow: 'hidden' }}
        >
          <motion.div
            className={`mp-accordion-content ${className}`.trim()}
            initial="collapsed"
            animate="expanded"
            exit="collapsed"
            variants={variants}
            transition={transition}
            {...props}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default Accordion;
