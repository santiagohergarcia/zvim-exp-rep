sap.ui.define(
	['sap/ui/model/Filter', 
	'sap/ui/model/FilterOperator'], 
	function(Filter, FilterOperator) {
	'use strict';
	return {
	
		/**
		 * Get user details
		 * @return Promise of user detail service
		 */
		getUserDetails: function(apModel, sUserId) {
			return new Promise(function(resolve, reject) {
				apModel.read('/UserListSet', {
					filters: [new Filter('USER', FilterOperator.EQ, sUserId)],
					success: function(oData) {
						resolve(oData.results);
					},
					error: function(oError) {
						reject(oError);
					}
				});
			});
		},

		/**
		 * Format Cost Center
		 */
		removeLeadingZeros: function(sValue) {
			if (sValue)
			{
			return parseInt(sValue, 10);
			}
		}
	};
});