sap.ui.define([], function() {
  'use strict';

  return {
    /* =========================================================== */
    /* formatter methods                                           */
    /* =========================================================== */
    removeLeadingZeros: function(sValue) {
      if (sValue) return parseInt(sValue, 10);
    },
    isDetailVisible: function(sSpkzl) {
      var oSpkzl, iCalcRate;
      if (sSpkzl && sSpkzl !== '--Select--' && this.getModel().getProperty('/ExpenseType')) {
        oSpkzl = this.getModel().getProperty('/ExpenseType')[sSpkzl];
        if (oSpkzl) {
          iCalcRate = parseInt(oSpkzl.CalcRate);
          return iCalcRate > 0 || oSpkzl.Title.trim().length > 0;
        } else return false;
      } else return false;
    }
  };
});
