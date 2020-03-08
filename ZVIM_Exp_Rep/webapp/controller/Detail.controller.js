sap.ui.define(
	[
		'vim/ap/controller/BaseController',
		'vim/ap/utils/Helper',
		'vim/ap/utils/Formatter',
		'sap/ui/model/json/JSONModel',
		'sap/m/MessageToast',
		'sap/ui/model/Filter',
		'sap/ui/model/FilterOperator',
		'sap/m/Dialog',
		'sap/ui/core/routing/History',
		'sap/m/UploadCollectionParameter',
		'sap/m/MessagePopover',
		'sap/m/MessageBox',
		'sap/ui/core/BusyIndicator'
	],
	function(
		BaseController,
		Helper,
		Formatter,
		JSONModel,
		MessageToast,
		Filter,
		FilterOperator,
		Dialog,
		History,
		UploadCollectionParameter,
		MessagePopover,
		MessageBox,
		BusyIndicator
	) {
		var sInvoicePath, sGlobalRecNo;

		return BaseController.extend('vim.ap.controller.Detail', {
			formatter: Formatter,
		
			/**
			 * Instantiate the services for Expense Report application
			 * 
			 */
			onInit: function() {
				var oViewModel = this._createViewModel();
				oViewModel.setSizeLimit(1000);
				this.setModel(oViewModel, "detailView");
				var oApModel = this.getOwnerComponent().getModel();
				oApModel.setHeaders({
					PTSMaxHits: '50'
				});
				oApModel
					.metadataLoaded()
					.then(
						function() {
							return this._callUserDetailsService(this.getOwnerComponent().getModel());
						}.bind(this)
					)
					.then(
						function() {
							return this._callExpenseTypeService(this.getOwnerComponent().getModel(), this.getModel("detailView").getProperty(
								"/userDetail/Bukrs"));
						}.bind(this)
					)
					.then(
						function() {
							return this._callPaymentTermsService(this.getOwnerComponent().getModel());
						}.bind(this)
					)
					.then(
						function() {
							//Set the the headers for the AP Model
							if (window.location.hostname.indexOf('ondemand.com') !== -1) {
								oApModel.setHeaders({
									PTSMaxHits: '50',
									PTSUser: oCurrentUser.name
								});
							} else {
								oApModel.setHeaders({
									PTSUser: this.getModel("detailView").getProperty("/userDetail/Xuser"),
									PTSMaxHits: '50'
								});
							}
							this.getRouter().initialize();
						}.bind(this)
					)
					.catch(function(oError) {
						MessageToast.show(oError);
					});

				oApModel.attachMetadataFailed(function() {
					MessageToast.show('Connection to SAP Gateway is failed!!!');
				});

				// Hacking the Vim header to show version number
				var vimShell = this.byId('myShell-header'),
					version = this.getOwnerComponent()
					.getMetadata()
					.getVersion();
				if (vimShell) {
					vimShell.addDelegate({
							onAfterRendering: function() {
								$('#' + this.getId() + '-icon').attr('alt', version);
								$('#' + this.getId() + '-icon').attr('title', version);
							}
						},
						false,
						vimShell,
						true
					);
				}
			},
			
			/**
			 * Get the user Details
			 * 
			 */
			_callUserDetailsService: function(apModel) {
				var that = this;
				return new Promise(function(resolve, reject) {
					apModel.read('/UserListSet', {
						filters: [new Filter('Xuser', FilterOperator.EQ, '')],
						success: function(oData, oResponse) {
							that.getModel("detailView").setProperty("/defaultUser", oData.results[0]);
							that.getModel("detailView").setProperty("/userDetail", oData.results[0]);
							resolve();
						}.bind(that),
						error: function(oError) {
							reject(oError);
						}
					});
				});
			},
			
			/**
			 * Get the Payment Terms list 
			 */
			_callPaymentTermsService: function(apModel) {
				var that = this;
				return new Promise(function(resolve, reject) {
					apModel.read('/PaymentTermsOVSSet', {
						filters: [],
						success: function(oData, oResponse) {
							that.getModel("detailView").setProperty("/PaymentMethods", oData.results);
							resolve();
						}.bind(that),
						error: function(oError) {
							reject(oError);
						}
					});
				});
			},
			
			/**
			 * Get the list of Expense List 
			 */
			_callExpenseTypeService: function(erModel, sCompCode) {
				var that = this;
				return new Promise(function(resolve, reject) {
					erModel.read('/ExpenseTypeSet', {
						filters: [new Filter('CompanyCode', FilterOperator.EQ, sCompCode)],
						success: function(oData, oResponse) {
							oData.results.unshift({
								ExpType: undefined,
								NameOfExpType: '--Select--'
							});

							that.getModel("detailView").setProperty("/ExpenseTypeSet", oData.results);
							that.setModel(
								oData.results.reduce(function(oFinal, oLine) {
									oFinal[oLine.ExpType] = oFinal[oLine.ExpType] || {};
									oFinal[oLine.ExpType].CompanyCode = oLine.CompanyCode;
									oFinal[oLine.ExpType].NameOfExpType = oLine.NameOfExpType;
									oFinal[oLine.ExpType].CalcRate = oLine.CalcRate;
									oFinal[oLine.ExpType].Vat = oLine.Vat;
									oFinal[oLine.ExpType].Hkont = oLine.Hkont;
									oFinal[oLine.ExpType].CountryKey = oLine.CountryKey;
									oFinal[oLine.ExpType].Title = oLine.Title;
									return oFinal;
								}, {}),
								'ExpenseType'
							);
							resolve(oData);
						},
						error: function(oError) {
							reject(oError);
						}
					});
				});
				this.getRouter().attachRouteMatched(this._onAttachRouteMatched, this);
			},
			_onAttachRouteMatched: function(oEvent) {
				var oModel = this.getOwnerComponent().getModel();
			},
			version: function() {
				return this.getOwnerComponent().getMetadata().getVersion();
			},
			
			/**
			 * Add a Manager -as Approver  
			 */
			handleAddManager: function(oEvent) {
				//Get the manager user id from the user model
				this.getModel("detailView").setProperty('/Approvers', []);
				var sMgrUserId = this.getModel("detailView").getProperty("/userDetail/MgrUserId");
				if (sMgrUserId && sMgrUserId.length > 0) {
					//Call the user detail service with the manager id to get the mgr deatils
					Helper.getUserDetails(this.getOwnerComponent().getModel(), sMgrUserId).then(
						function(oData) {
							//Success
							//Check if the result returned atleast one row of result
							if (oData.length > 0) {
								//Create a mgr object
								var oMgr = {
									ApproverID: sMgrUserId,
									ApproverName: oData[0].Fname + ' ' + oData[0].Lname,
									isManager: "X"
								};
								//If the model exists already add the object
								if (this.getModel("detailView").getProperty('/Approvers')) {
									this.getModel("detailView").getProperty('/Approvers').push(oMgr);
									oMgr.Seq = this.getModel("detailView").getProperty('/Approvers').length;
								} else {
									//Else set a new array to the object
									this.getModel("detailView").setProperty('/Approvers', [oMgr]);
									oMgr.Seq = 1;
								}
								this.getModel("detailView").refresh();
							} else {
								MessageToast.show('No details for the Manager id:' + sMgrUserId);
							}
						}.bind(this),
						function(oError) {
							//Error
							this._showErrorDialog(oError);
						}.bind(this)
					);
				} else
					MessageBox.show('Cannot retrieve Manager ID for the user', {
						icon: MessageBox.Icon.WARNING,
						title: 'Warning',
						actions: ['OK'],
						initialFocus: 'OK'
					});
			},

	        /**
			 * Change the Approver  
			 */
			handleApproverChange: function(oEvent) {
				var sUserId = oEvent.getParameter('value'), //gets the user typed value
					sPath = oEvent.getSource().getBindingContext("detailView").sPath, //gets the row number of the table where the user is typing
					oRowModel = oEvent.getSource().getBindingContext("detailView").getProperty(sPath), // gets the table row object
					detailController = this;
				BusyIndicator.show(); //starts the busy dialog before the user search
				Helper.getUserDetails(this.getOwnerComponent().getModel(), sUserId) // calls te promise method for getting the user details
					.then(function(oData) {
						BusyIndicator.hide();
						if (oData.length > 1) MessageToast.show('More than one user found with ' + sUserId);
						else if (oData.length == 1) {
							//Only update the table if and only if one element is returned
							oRowModel.ApproverID = oData[0].Xuser;
							oRowModel.ApproverName = oData[0].Fname + ' ' + oData[0].Lname;
							detailController.getView().getModel("detailView").refresh();
						} else MessageToast.show('No valid users found with ' + sUserId);
					});
			},
			
		    /**
			 * Add a Line Item  
			 */
			handleAddItem: function(oEvent) {
				var oModel = this.getModel("detailView");
				var oInvoiceItem = {
					Bukrs: oModel.getProperty('/userDetail/Bukrs'),
					Kostl: oModel.getProperty('/userDetail/Kostl'),
					CustomField3: 'CA'
				};
				this.getView()
					.byId('Exp')
					.setEnabled(true);

				if (oModel.getProperty('/InvoiceItems'))
					oModel.getProperty('/InvoiceItems')
					.push(oInvoiceItem);
				else oModel.setProperty('/InvoiceItems', [oInvoiceItem]);
				oModel.refresh();
			},
			
			 /**
			 * Copy a Line Item  
			 */
			handleERCopyItem: function(oEvent) {
				var sPath = oEvent.getSource().getParent().getParent().getSelectedItems()[0].getBindingContext("detailView").sPath;
				var oSelectedRow = oEvent.getSource().getParent().getParent().getSelectedItems()[0]
					.getBindingContext("detailView").getProperty(sPath);
				// this is deep copy of the object-oSelectedRow
				this.getModel("detailView").getProperty('/InvoiceItems').push(jQuery.extend(true, {}, oSelectedRow));
				this.getModel("detailView").refresh();
			},
			
			 /**
			 * Delete a Line Item  
			 */
			handleInvoiceDeleteItem: function(oEvent) {
				if (oEvent.getSource().getParent().getParent().getSelectedItems().length === 0) {
					return MessageToast.show('Please select a row');
				}
				var sPath = oEvent.getSource().getParent().getParent().getSelectedItems()[0].getBindingContext("detailView").sPath;
				var selectedIndex = sPath.slice(sPath.lastIndexOf('/') + 1);
				this.getModel("detailView").getProperty('/InvoiceItems').splice(selectedIndex, 1);
				this.getModel("detailView").refresh();
			},
			
			 /**
			 * Delete a Approver   
			 */
			handleApproverDeleteItem: function(oEvent) {
				if (
					oEvent.getSource().getParent().getParent().getSelectedItems().length > 0
				) {
					var sPath = oEvent.getSource().getParent().getParent().getSelectedItems()[0].getBindingContext("detailView").sPath;
					var detailView = this.getModel("detailView");
					var oSelectedApprover = detailView.getProperty(sPath);
					var selectedIndex = sPath.slice(sPath.lastIndexOf('/') + 1);
					detailView.getProperty('/Approvers').splice(selectedIndex, 1);
					detailView.getProperty('/Approvers')
						.forEach(function(oApprover, index) {
							oApprover.Seq = index += 1;
						});
					detailView.refresh();
					if (oSelectedApprover.ApproverID) {
						MessageToast.show(oSelectedApprover.ApproverID + ' removed');
					} else {
						MessageToast.show('Approver line removed');
					}
				} else {
					MessageToast.show('Please select a row');
				}
			},

            /**
			 * Get G/L account based on the Expense type selected
			 */
			handleExpTypeChange: function(oEvent) {
				if (oEvent.getSource().getSelectedKey()) {
					var sPath = oEvent.getSource().getBindingContext("detailView").sPath,
						iPath = oEvent.getSource().getSelectedIndex() - 1;
					var Hkont = this.getModel("detailView").getProperty("/ExpenseTypeSet")[iPath].GLAcc;
					this.getModel("detailView").getProperty(sPath).Hkont = Hkont;
				}
				this.getModel("detailView").refresh();
			},
			
			 /**
			 * Message popover 
			 */
			handleMessagePress: function(oEvent) {
				if (!this._oMsgPopover) {
					this._oMsgPopover = sap.ui.xmlfragment('vim.ap.view.MessagePopover', this);
					this.getView().addDependent(this._oMsgPopover);
				}
				this._oMsgPopover.openBy(oEvent.getSource());
			},

             /**
			 * Submit the data to backend
			 */
			handleSubmit: function(oEvent) {
				var controller = this;
				this._postHeaderService(1)
					.then(
						function(oData) {
							var __controller__ = this;
							MessageToast.show(oData.NAV_STATUS.Docid + ' submitted successfully', {
								duration: 3000
							});
						}.bind(this)
					)
					.catch(
						function(oError) {
							var errObj = JSON.parse(oError.responseText);
							if (errObj.error.innererror.errordetails[0].severity == 'warning') {
								MessageBox.show(errObj.error.message.value, {
									icon: MessageBox.Icon.WARNING,
									title: controller.i18n('CONFIRMATION'),
									actions: [controller.i18n('CANCEL_ACTION'), controller.i18n('CONTINUE_ACTION')],
									onClose: function(oAction) {
										if (oAction === controller.i18n('CONTINUE_ACTION')) {
											controller
												._postHeaderService(1, 'X')
												.then(
													function(oData) {
														MessageToast.show(oData.RecNo + ' submitted successfully', {
															duration: 3000
														});
													}.bind(controller)
												)
												.catch(function(error) {
													controller._showErrorDialog(oError);
												});
										} else if (oAction === controller.i18n('CANCEL_ACTION')) {}
									}
								});
							} else {
								this._showErrorDialog(oError);
							}
						}.bind(this)
					);
			},

           /**
			 * Update
			 */
			handleUpdateFinished: function(oEvent) {
				if (oEvent.getParameter('total') == 0) {
					oEvent.getSource().setVisible(false);
				} else if (oEvent.getParameter('total') == 1) {
					oEvent.getSource().setVisible(true);
					oEvent.getSource().getItems()[0].setSelected(true);
				} else oEvent.getSource().setVisible(true);
			},
		
             /**
			 * User Details
			 */
			handleReportForChange: function(oEvent) {
				var sText = oEvent.getParameter('value'),
					oModel = this.getModel("detailView"),
					ovsService = '/UserListSet',
					sSearchField1 = 'USER',
					sResultField1 = 'Koslt',
					sResultField2 = 'Bukrs',
					aFilter = [new Filter('USER', FilterOperator.EQ, sText)],
					that = this,
					orFilter = [];
				orFilter.push(new Filter(aFilter, false));
				BusyIndicator.show();
				this.getOwnerComponent()
					.getModel()
					.read(ovsService, {
						filters: orFilter,
						success: function success(oData) {
							if (oData.results && oData.results.length > 1) {
								oModel.setProperty('/userDetail/Waers', '');
								oModel.setProperty('/userDetail/Bukrs', '');
								oModel.setProperty('/userDetail/Kostl', '');
								oModel.setProperty('/userDetail/Lname', '');
								oModel.setProperty('/userDetail/Fname', '');
								oModel.setProperty('/userDetail/MgrUserId', '');
								oModel.refresh();
								MessageBox.show(
									'More than one user found based on your input. Please put exact userid. The existing Company Code, Currency and Cost Center are updated as blank', {
										icon: MessageBox.Icon.WARNING,
										title: 'Warning',
										actions: ['Close'],
										initialFocus: 'Close'
									}
								);
							} else if (oData.results && oData.results.length === 1) {
								oModel.setProperty('/userDetail/MgrUserId', oData.results[0].MgrUserId);
								oModel.setProperty('/userDetail/Bukrs', oData.results[0].Bukrs);
								oModel.setProperty('/userDetail/Kostl', oData.results[0].Kostl);
								oModel.setProperty('/userDetail/Lname', oData.results[0].Lname);
								oModel.setProperty('/userDetail/Fname', oData.results[0].Fname);
								var itemLines = oModel.getProperty("/InvoiceItems");
								if (itemLines) {
									itemLines.forEach(function(val, i) {
										oModel.setProperty('/InvoiceItems/' + i + '/Bukrs', oData.results[0].Bukrs);
										oModel.setProperty('/InvoiceItems/' + i + '/ExpCurrency', oData.results[0].Waers);
										oModel.setProperty('/InvoiceItems/' + i + '/Kostl', oData.results[0].Kostl);
									});
								} else {
									oModel.setProperty('/InvoiceItems/0/ExpCurrency', oData.results[0].Waers);
									oModel.setProperty('/InvoiceItems/0/Bukrs', oData.results[0].Bukrs);
									oModel.setProperty('/InvoiceItems/0/Kostl', oData.results[0].Kostl);
								}
								MessageToast.show('Company Code, Currency and Cost Center and Credit Card lines(if any) have been updated');
								MessageBox.show('Company Code, Currency and Cost Center and Credit Card lines(if any) have been updated', {
									icon: MessageBox.Icon.SUCCESS,
									title: 'Success',
									actions: ['OK'],
									initialFocus: 'OK'
								});
							} else {
								MessageBox.show(
									'No user details were obtained based on your input. However the existing Company Code, Currency and Cost Center are updated as blank', {
										icon: MessageBox.Icon.WARNING,
										title: 'Warning',
										actions: ['Close'],
										initialFocus: 'Close'
									}
								);
								oModel.setProperty('/userDetail/Lname', '');
								oModel.setProperty('/userDetail/Fname', '');
							}
							BusyIndicator.hide();
							that.getModel("detailView").refresh();
						},
						error: function error(oError) {
							BusyIndicator.hide();
						}
					});
				this.getModel("detailView").refresh();
			},
			
		    /**
			 * Messages popover
			 */
			handleMessagePopoverPress: function(oEvent) {
				var oMessagePopover = sap.ui.xmlfragment('vim.ap.fragment.MessagePopover', this);
				oMessagePopover.setModel(this.getModel("detailView"), "detailView");
				oMessagePopover.toggle(oEvent.getSource());
			},
			
			/* =========================================================== */
			/*              I N T E R N A L   M E T H O D S                */
			/* =========================================================== */
		   
		    /**
			 * Message Model
			 */
			_setMessageModel: function(oData) {
				var oMsgModel = new JSONModel(oData.error.innererror.errordetails);
				this.setModel(oMsgModel, 'messages');
			},
			
			/**
			 * Set the data for posting header structure
			 */
			_postHeaderService: function(saveType, ignoreFlag) {
				this._checkMandatoryFields(saveType);
				this.getModel("detailView").refresh();
				var aMessages = this.getView().getModel("detailView").getProperty('/Messages');
				var bErrorMessages = false,
					bWarningMessages = false;
				if (aMessages) {
					aMessages.forEach(function(oMessage) {
						if (oMessage.type === 'Error') bErrorMessages = true;
						if (oMessage.type === 'Warning') bErrorMessages = true;
					});
				}
				if (!bErrorMessages) {
					var oTracks = {},
						oErModel = this.getOwnerComponent().getModel();
					var detailView = this.getModel("detailView");
					oTracks = {
						
						/* Handling constant values in backend */
						"Doctype": "",
						"ArchivId": "",
						"ChannelId": "",
						"ArObject": "",
						/* End of constant values */
						
						"ArcDocId": "FAC5878743971EDA92C1A7946693C623",
						"Bktxt": detailView.getProperty("/DocumentHeaderText"),
						"UserId" : detailView.getProperty("/userDetail/USER"),
						"Xblnr": detailView.getProperty("/DocumentHeaderText").substr(0, 14),
						"Bldat": detailView.getProperty("/reportDate"),
						"Lifnr": detailView.getProperty("/userDetail/Phone"), //payee User
						"Waers": detailView.getProperty("/userDetail/Waers"),
						"GrossAmount": JSON.stringify(detailView.getProperty("/userDetail/Amount")),
						"Bukrs": detailView.getProperty("/userDetail/Bukrs"),
						"Requisitioner": detailView.getProperty("/Approvers/0/isManager") === "X" ? detailView.getProperty('/Approvers/0/ApproverID') : "", //Manager uname
						"PymntTerms": detailView.getProperty('/PaymentMethods/0/TermsOfPaymentKey'),
						"PymntTermsText": detailView.getProperty('/PaymentMethods/0/TermsOfPayment')
				//		"Attribute4": detailView.getProperty("/Approvers/0/isManager") === "X" ? "" : detailView.getProperty('/Approvers/0/ApproverID') //Approval uname if Manager Uname is initial
					};
					oTracks.NAV_ITEMS = this.getModel("detailView").getProperty('/InvoiceItems');
					for (var i = 0; i < oTracks.NAV_ITEMS.length; i++) {
						delete oTracks.NAV_ITEMS[i].PymntTerms;
						delete oTracks.NAV_ITEMS[i].Aufnrtxt;
						delete oTracks.NAV_ITEMS[i].Gltxt;
					}
					oTracks.NAV_STATUS = {};
					oTracks.NAV_COMMENTS = [{
						Tdline: this.getModel("detailView").getProperty('/notes')
					}];

					BusyIndicator.show();

					return new Promise(function(resolve, reject) {
						oErModel.create('/DOC_HEADERSet', oTracks, {
							success: function success(oData, response) {
								resolve(oData);
								BusyIndicator.hide();
							},
							error: function error(oError) {
								reject(oError);
								BusyIndicator.hide();
							}
						});
					});
				} else {
					var responseText = {
						error: {
							innererror: {
								errordetails: aMessages
							},
							message: {
								value: 'Action not successful. Open message box for more details'
							}
						}
					};
					var oError = {
						responseText: JSON.stringify(responseText),
						message: 'Missing mandatory fields'
					};
					//   this._showErrorDialog(oError);
					return Promise.reject(oError);
				}
			},
			
		   /**
			 * calculate Reimbursement Amount 
			 */
			handleReimbursementAmount : function(){
				var lv_amount = "";
					var InvoiceItems = this.getModel("detailView").getProperty("/InvoiceItems");
					for(var i=0; i<InvoiceItems.length; i++){
						if(InvoiceItems[i].Wrbtr){
							lv_amount = Number(lv_amount) + Number(InvoiceItems[i].Wrbtr);
						}
					}
					this.getModel("detailView").setProperty("/userDetail/Amount", lv_amount);
			},
			
		   /**
			 * Mandatory Fields 
			 */
			_checkMandatoryFields: function(saveType) {
				this.getModel("detailView").setProperty('/Messages', []);
				var message = [];
				var aInvoiceReqdFields, aMissingFields, that = this,
					aCustomMessage = {};
				var detailView = this.getModel("detailView");
			
				if(!detailView.getProperty("/DocumentHeaderText")){
						aCustomMessage = {
						type: 'Error',
						title: 'Header Text',
						description: 'Header text mandatory',
						subtitle: 'Click for more info'
					};
					message.push(aCustomMessage);
				}
				if(!detailView.getProperty("/reportDate")){
						aCustomMessage = {
						type: 'Error',
						title: 'Report Date',
						description: 'Report Date mandatory',
						subtitle: 'Click for more info'
					};
					message.push(aCustomMessage);
				}
				/*Invoice Items checking*/
				var aInvoiceItems = detailView.getProperty('/InvoiceItems');
				if (!aInvoiceItems || aInvoiceItems.length === 0) {
					aCustomMessage = {
						type: 'Error',
						title: 'Invoice Items mandatory field(s) missing',
						description: 'All mandatory fields are missing',
						subtitle: 'Click for more info'
							//  counter: aMissingFields.length
					};
					message.push(aCustomMessage);
				}
				for(var i=0; i<aInvoiceItems.length; i++){
					if(!aInvoiceItems[i].CustomField3 || !aInvoiceItems[i].Hkont  || !aInvoiceItems[i].Aufnr || !aInvoiceItems[i].Sgtxt){
						aCustomMessage = {
						type: 'Error',
						title: 'Invoice Items mandatory field(s) missing',
						description: 'Following fields are mandatory value : Expense, GL Account, Payment Term, Order, Line Text',
						subtitle: 'Click for more info'
					};
					message.push(aCustomMessage);	
					}
				}
				//Note is required 
				var notes = detailView.getProperty('/notes');
				if (!notes) {
					aCustomMessage = {
						type: 'Error',
						title: 'Missing Notes',
						description: 'Notes text is mendetory',
						subtitle: 'Click for more info'
							// counter: aMissingFields.length
					};
					message.push(aCustomMessage);
				}
				//Approver is required 
				var oApprovers = detailView.getProperty('/Approvers');
				if (!oApprovers || oApprovers.length === 0 || !oApprovers[0].ApproverID) {
					aCustomMessage = {
						type: 'Error',
						title: 'Missing approver',
						description: 'Atleast one approver is required for submitting',
						subtitle: 'Click for more info'
							// counter: aMissingFields.length
					};
					message.push(aCustomMessage);
				}
				// Attachment is required unless expense type is mileage only
				// f.	Submit should fail with error message if no attachment and expense type <> mileage
				// g.	Submit should succeed if no attachment and expense type = mileage; PDF should be simulated (WEB_ER_SIMULATE_PDF)
				var aInvoiceItems = detailView.getProperty('/InvoiceItems');
				var bIsNonMileageTypePresent = false;
				if (saveType === 10) {
					//Check for attachments
					var GUIDs = this.getModel("detailView").getProperty('/Attachments/GUIDs');
					var sUri = this.getModel("detailView").getProperty('/Tracks/URI');
					if (!GUIDs && !sUri) {
						var aCustomMessage = {
							type: 'Error',
							title: 'Missing attachment',
							description: 'Atleast one attachment is required for non mileage expense types',
							subtitle: 'Click for more info'
								// counter: aMissingFields.length
						};
						message.push(aCustomMessage);
					}
				}
				if (message.length > 0) {
					this.getModel("detailView").setProperty('/Messages', message);
				}
			},
			
			 /**
			 * Handling Error  
			 */
			_showErrorDialog: function(oError) {
				var oErrorResponse = JSON.parse(oError.responseText),
					aErrorMessage = [];
				oErrorResponse.error.innererror.errordetails.forEach(
					function(e) {
						var oErrorMessage = {};
						if (e.message) {
							if (e.severity === 'error') oErrorMessage.type = 'Error';
							oErrorMessage.title = e.message;
							aErrorMessage.push(oErrorMessage);
						}
						if (e.MSG) {
							if (e.TYPE === 'E') oErrorMessage.type = 'Error';
							if (e.TYPE === 'S' || e.TYPE === 'I') oErrorMessage.type = 'Information';
							oErrorMessage.title = e.MSG;
							aErrorMessage.push(oErrorMessage);
						}
					}.bind(aErrorMessage)
				);
				if (aErrorMessage.length > 0) {
					this.getModel("detailView").setProperty('/Messages', aErrorMessage);
				}
				if (oErrorResponse.error.message) {
					var dialog = new Dialog({
						title: 'Error',
						type: 'Message',
						state: 'Error',
						content: new sap.m.Text({
							text: oErrorResponse.error.message.value
						}),
						beginButton: new sap.m.Button({
							text: 'OK',
							press: function press() {
								dialog.close();
							}
						}),
						afterClose: function afterClose() {
							dialog.destroy();
						}
					});
					dialog.open();
				}

				jQuery.sap.delayedCall(500, this, function(oMessagePopover) {
					var oMessagePopover = sap.ui.xmlfragment('vim.ap.fragment.MessagePopover', this);
					oMessagePopover.setModel(this.getModel("detailView"), "detailView");
					oMessagePopover.toggle(this.byId('idMessageButton'));
					this.getModel("detailView").refresh();
				});
			},
			
			/**
			 * Create the view Model
			 */
			_createViewModel: function() {
				var Attachments = {
						uploadURL: "",
						files: []
					},
					userOVS = {
						results: [],
						busy: true,
						ovsTitle: ""
					};
				return new JSONModel({
					DocumentHeaderText: "",
					reportDate: null,
					defaultUser: {},
					userDetail: {},
					userList: {},
					notes: "",
					Approvers: [],
					PaymentMethods: [],
					approverOVS: [],
					InvoiceItems: [],
					expenseList: [],
					paymentMode: [],
					orderOVS: [],
					Messages: [],
					footer: {},
					Attachments: Attachments,
					userOVS: userOVS
				});
			}
		});
	}
);