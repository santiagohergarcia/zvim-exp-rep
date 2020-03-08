sap.ui.define(
	[
		'sap/ui/core/mvc/Controller',
		'sap/ui/model/json/JSONModel',
		'sap/ui/model/Filter',
		'sap/ui/model/FilterOperator'
	],
	function(Controller, JSONModel, Filter, FilterOperator) {
		'use strict';
		var inputId = '';
		return Controller.extend('vim.ap.controller.BaseController', {
			onInit: function() {
				this.setModel(new JSONModel());
			},

			/**
			 * Convenience method for accessing the router.
			 * @public
			 * @returns {sap.ui.core.routing.Router} the router for this component
			 */
			getRouter: function() {
				return sap.ui.core.UIComponent.getRouterFor(this);
			},
			/**
			 * Convenience method for getting the view model by name.
			 * @public
			 * @param {string} [sName] the model name
			 * @returns {sap.ui.model.Model} the model instance
			 */
			getModel: function(sName) {
				return this.getView().getModel(sName);
			},

			/**
			 * Convenience method for setting the view model.
			 * @public
			 * @param {sap.ui.model.Model} oModel the model instance
			 * @param {string} sName the model name
			 * @returns {sap.ui.mvc.View} the view instance
			 */
			setModel: function(oModel, sName) {
				return this.getView().setModel(oModel, sName);
			},

			/**
			 * Convenience method for getting the resource bundle.
			 * @public
			 * @returns {sap.ui.model.resource.ResourceModel} the resourceModel of the component
			 */
			getResourceBundle: function() {
				return this.getOwnerComponent().getModel("i18n").getResourceBundle();
			},
			
			/**
			 * Shows a message popup dialog in case of error
			 * @params : oError
			 */
			displayErrorPopup: function(oError) {
				var title, errorMsg;
				if (oError.responseText) {
					errorMsg = JSON.parse(oError.responseText).error.message.value;
					title = oError.message;
				}
				var dialog = new sap.m.Dialog({
					title: title,
					type: 'Message',
					state: 'Error',
					content: [
						new sap.m.Text({
							text: errorMsg
						})
					],
					beginButton: new sap.m.Button({
						text: 'OK',
						press: function() {
							dialog.close();
						}
					}),
					afterClose: function() {
						dialog.destroy();
					}
				});
				dialog.open();
			},

			/* 
			* Value help for User
			*/
			handleReportForValueHelp: function(oEvent) {
				this.inputId = oEvent.getSource().getId();
				var that = this;
				var oModel = this.getModel("detailView");
				oModel.setProperty("/userOVS/ovsTitle", 'Select a user'),
					oModel.setProperty("/userOVS/resultColumnDesc1", 'User ID'),
					oModel.setProperty("/userOVS/resultColumnDesc2", 'Display Name');
				if (!that.ReportForOVS) {
					that.ReportForOVS = sap.ui.xmlfragment('vim.ap.fragment.UserValueHelp', this);
					//to get access to the global model
					this.getView().addDependent(that.ReportForOVS);
				}
				that.ReportForOVS.open();
			},
			
			handleReportForOVSClose: function(oEvent) {
				var oModel = this.getModel("detailView");
				var aContexts = oEvent.getParameter('selectedContexts');
				if (aContexts) {
					oModel.setProperty('/userDetail/MgrUserId',
						aContexts
						.map(function(oContext) {
							return oContext.getObject()['MgrUserId'];
						})
						.join(', ')
					);

					var filterInput = this.getView().byId(this.inputId),
						oCostCenterInputField = this.getView().byId('idInputKostl'),
						oCompanyCodeInputField = this.getView().byId('idInputBukrs'),
						oCurrencyInputField = this.getView().byId('idHeaderCurrency'),
						sSelectedValue = aContexts
						.map(function(oContext) {
							return oContext.getObject()[filterInput.data('ovsResultField1')];
						})
						.join(', ');
					filterInput.setValue(sSelectedValue);
					filterInput.setValueState(sap.ui.core.ValueState.None);
					var that = this;
					oCostCenterInputField.setText(
						aContexts
						.map(function(oContext) {
							var items = oModel.getProperty("/InvoiceItems");
							if (items) {
								var itemLines = oModel.getProperty("/InvoiceItems");
								itemLines.forEach(function(val, i) {
									oModel.setProperty('/InvoiceItems/' + i + '/Kostl', oContext.getObject()['Kostl']);
									oModel.setProperty('/userDetail/Kostl', oContext.getObject()['Kostl']);
									return oContext.getObject()['Kostl'];
								});
							}
							oModel.setProperty('/InvoiceItems/0/Kostl', oContext.getObject()['Kostl']);
							oModel.setProperty('/userDetail/Kostl', oContext.getObject()['Kostl']);
							oModel.setProperty('/userDetail/Lname', oContext.getObject()['Lname']);
							oModel.setProperty('/userDetail/Fname', oContext.getObject()['Fname']);
							return oContext.getObject()['Kostl'];
						})
						.join(', ')
					);
					oCompanyCodeInputField.setText(
						aContexts
						.map(function(oContext) {
							var items = oModel.getProperty("/InvoiceItems");
							if (items) {
								var itemLines = oModel.getProperty("/InvoiceItems");
								itemLines.forEach(function(val, i) {
									oModel.setProperty('/InvoiceItems/' + i + '/Bukrs', oContext.getObject()['Bukrs']);
									return oContext.getObject()['Bukrs'];
								});
							}
							oModel.setProperty('/InvoiceItems/0/Bukrs', oContext.getObject()['Bukrs']);
							return oContext.getObject()['Bukrs'];
						})
						.join(', ')
					);
					oCurrencyInputField.setText(
						aContexts
						.map(function(oContext) {
							var items = oModel.getProperty("/InvoiceItems");
							if (items) {
								var itemLines = oModel.getProperty("/InvoiceItems");
								itemLines.forEach(function(val, i) {
									oModel.setProperty('/InvoiceItems/' + i + '/ExpCurrency', oContext.getObject()['Waers']);
									return oContext.getObject()['Waers'];
								});
							}
							oModel.setProperty('/InvoiceItems/0/ExpCurrency', oContext.getObject()['Waers']);
							return oContext.getObject()['Waers'];
						})
						.join(', ')
					);

					// sap.m.MessageToast.show('Company Code, Cost Center and Currency updated');
					oModel.updateBindings(true);
					oModel.refresh();
					sap.m.MessageBox.show('Company Code, Currency and Cost Center and Credit Card lines(if any) have been updated', {
						icon: sap.m.MessageBox.Icon.SUCCESS,
						title: 'Success',
						actions: ['OK'],
						initialFocus: 'OK'
					});
					var oInvoiceItem = oModel.getProperty('/InvoiceItems');
					if (oInvoiceItem) {
						oInvoiceItem.forEach(function(value, i) {
							if (value.CrgType === 'CC') {
								oModel.getProperty('/InvoiceItems')
									.splice(i);
								oModel.refresh();
							}
						});
					}
				}
			},
			handleReportForOVSCancel: function() {
				this.ReportForOVS.close();
			},
			handleReportForOVSSearch: function(oEvent) {
				var ovsService = '/UserListSet',
					ovsSearchField1 = 'USER',
					ovsResultField1 = 'Xuser',
					ovsResultField2 = 'Email',
					ovsTitle = 'Select a User';
				var aFilter = [new Filter('USER', FilterOperator.EQ, oEvent.getParameter('value'))],
					oModel = this.getModel("detailView");
				this.getOwnerComponent()
					.getModel()
					.read(ovsService, {
						filters: aFilter,
						success: function(oData) {
							oData.results.forEach(function(currentValue) {
								currentValue.ovsResultField1 = currentValue[ovsResultField1];
								currentValue.ovsResultField2 = currentValue[ovsResultField2];
							});
							oModel.setProperty('/userOVS/results', oData.results);
							oModel.setProperty('/userOVS/busy', false);
						}.bind({
							ovsResultField1: ovsResultField1,
							ovsResultField2: ovsResultField2,
							ovsTitle: ovsTitle
						}),
						error: function(oError) {
							oModel.setProperty('/userOVS/busy', false);
						}
					});
			}
		});
	}
);