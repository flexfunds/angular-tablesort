/*
 angular-tablesort v1.1.2 - MODIFIED
 (c) 2013-2015 Mattias Holmlund, http://mattiash.github.io/angular-tablesort
 License: MIT
*/

var tableSortModule = angular.module( 'tableSort', [] );

tableSortModule.provider('tableSortConfig', function () {
    this.filterTemplate = "";
    this.filterFunction = null;
    this.paginationTemplate = "";
    this.perPageOptions = [10, 25, 50, 100];
    this.perPageDefault = 10;
    
    this.$get = function () {
        return this;
    };

});

tableSortModule.directive('tsWrapper', ['$parse', '$compile', function( $parse, $compile ) {
    'use strict';
    
    function replaceTemplateTokens($scope, templateString){
        //Replace some strings with the proper expressions to be compiled
        return templateString
            .replace(/FILTER_STRING/g,"filtering.filterString")
            .replace(/CURRENT_PAGE_RANGE/g,"pagination.getPageRangeString(TOTAL_COUNT)")
            .replace(/TOTAL_COUNT/g, $scope.pagination.itemsArrayExpression + ".length")
            .replace(/PER_PAGE_OPTIONS/g, 'pagination.perPageOptions')
            .replace(/ITEMS_PER_PAGE/g, 'pagination.perPage')
            .replace(/FILTERED_COUNT/g,"filtering.filteredCount")
            .replace(/CURRENT_PAGE_NUMBER/g,"pagination.currentPage");
    }
    
    return {
        scope: true,
        controller: ['$scope', 'tableSortConfig', function($scope, tableSortConfig) {
            $scope.pagination = {
                template: tableSortConfig.paginationTemplate,
                perPageOptions: tableSortConfig.perPageOptions,
                perPage: tableSortConfig.perPageDefault,
                itemsArrayExpression: "", //this will contain the string expression for the array of items in the table
                currentPage: 1,
                getPageRangeString: function(total) {
                    //TODO: Format these numbers, perhaps optionally
                    var maxOnPage = total !== $scope.filtering.filteredCount ? $scope.filtering.filteredCount : total;
                    return (($scope.pagination.currentPage-1) * $scope.pagination.perPage) + 1 + "-" + Math.min(($scope.pagination.currentPage) * $scope.pagination.perPage, maxOnPage);
                }
            };

            $scope.filtering = {
                template: tableSortConfig.filterTemplate,
                filterString: "",
                filterFunction: tableSortConfig.filterFunction,
                filteredCount: 0,
                filterFields: []
           };

            $scope.sortExpression = [];
            $scope.headings = [];

            var parse_sortexpr = function( expr, name ) {
                return [$parse( expr ), null, false, name ? name : expr];
            };

            this.setSortField = function( sortexpr, element, name ) {
                var i;
                var expr = parse_sortexpr( sortexpr, name );
                if( $scope.sortExpression.length === 1
                    && $scope.sortExpression[0][0] === expr[0] ) {
                    if( $scope.sortExpression[0][2] ) {
                        element.removeClass( "tablesort-desc" );
                        element.addClass( "tablesort-asc" );
                        $scope.sortExpression[0][2] = false;
                    }
                    else {
                        element.removeClass( "tablesort-asc" );
                        element.addClass( "tablesort-desc" );
                        $scope.sortExpression[0][2] = true;
                    }
                    $scope.$emit('tablesort:sortOrder', [{
                      name: $scope.sortExpression[0][3],
                      order: $scope.sortExpression[0][2]
                    }]);
                }
                else {
                    for( i=0; i<$scope.headings.length; i=i+1 ) {
                        $scope.headings[i]
                            .removeClass( "tablesort-desc" )
                            .removeClass( "tablesort-asc" );
                    }
                    element.addClass( "tablesort-asc" );
                    $scope.sortExpression = [expr];
                    $scope.$emit('tablesort:sortOrder', [{
                      name: expr[3],
                      order: expr[2]
                    }]);
                }
            };

            this.addSortField = function( sortexpr, element, name ) {
                var i;
                var toggle_order = false;
                var expr = parse_sortexpr( sortexpr, name );
                for( i=0; i<$scope.sortExpression.length; i=i+1 ) {
                    if( $scope.sortExpression[i][0] === expr[0] ) {
                        if( $scope.sortExpression[i][2] ) {
                            element.removeClass( "tablesort-desc" );
                            element.addClass( "tablesort-asc" );
                            $scope.sortExpression[i][2] = false;
                        }
                        else {
                            element.removeClass( "tablesort-asc" );
                            element.addClass( "tablesort-desc" );
                            $scope.sortExpression[i][2] = true;
                        }
                        toggle_order = true;
                    }
                }
                if( !toggle_order ) {
                    element.addClass( "tablesort-asc" );
                    $scope.sortExpression.push( expr );
                }

                $scope.$emit('tablesort:sortOrder', $scope.sortExpression.map(function (a) {
                  return {
                    name: a[3],
                    order: a[2]
                  };
                }));

            };

            this.setTrackBy = function( trackBy ) {
                $scope.trackBy = trackBy;
            };

            this.registerHeading = function( headingelement ) {
                $scope.headings.push( headingelement );
            };

            this.addFilterField = function( sortexpr, element, name ) {
                var expr = parse_sortexpr( sortexpr, name );
                $scope.filtering.filterFields.push( expr )
            };

            this.setDataForPager = function( dataArrayExp ){
                $scope.pagination.itemsArrayExpression = dataArrayExp;
            }
        }],
        link: function($scope, $element, $attrs){
            
            //local attribute usages of the pagination/filtering options will override the global config
            if($attrs.tsPerPageOptions){
                $scope.pagination.perPageOptions = $scope.$eval($attrs.tsPerPageOptions);
            }

            if($attrs.tsPerPageDefault){
                $scope.pagination.perPage = $scope.$eval($attrs.tsPerPageDefault);
            }
            
            if($attrs.tsFilterFunction){
                //if the table attributes has a filter function on it, this takes priority
                $scope.filtering.filterFunction = $scope.$eval($attrs.tsFilterFunction);
            }

            if(!angular.isFunction($scope.filtering.filterFunction)) {
                //if no custom filter function was used in the config, use this as the default one
                $scope.filtering.filterFunction = function(item){
                    var shouldInclude = false;
                    for( var i=0; i<$scope.filtering.filterFields.length; i=i+1 ) {
                        if(!shouldInclude){
                            var str = ($scope.filtering.filterFields[i][0](item) || "").toString(); //parse the item's property using the `ts-criteria` value & filter
                            shouldInclude = str.indexOf($scope.filtering.filterString.toLowerCase()) > -1;
                        }
                    }
                    return shouldInclude;
                }
            }

            $scope.filterLimitFun = function(array){
                if(!$attrs.tsFilterFunction && $scope.filtering.filterString === ""){
                    //Return unfiltered when NOT using a custom filter function and when nothing is being searched
                    $scope.filtering.filteredCount = array.length;
                    return array;
                }
                var filteredArr = array.filter($scope.filtering.filterFunction);
                $scope.filtering.filteredCount = filteredArr.length;
                return filteredArr;
            };

            $scope.sortFun = function( a, b ) {
                var i, aval, bval, descending, filterFun;
                for( i=0; i<$scope.sortExpression.length; i=i+1 ){
                    aval = $scope.sortExpression[i][0](a);
                    bval = $scope.sortExpression[i][0](b);
                    filterFun = b[$scope.sortExpression[i][1]];
                    if( filterFun ) {
                        aval = filterFun( aval );
                        bval = filterFun( bval );
                    }
                    if( aval === undefined || aval === null ) {
                        aval = "";
                    }
                    if( bval === undefined || bval === null ) {
                       bval = "";
                    }
                    descending = $scope.sortExpression[i][2];
                    if( aval > bval ) {
                        return descending ? -1 : 1;
                    }
                    else if( aval < bval ) {
                        return descending ? 1 : -1;
                    }
                }

                // All the sort fields were equal. If there is a "track by" expression,
                // use that as a tiebreaker to make the sort result stable.
                if( $scope.trackBy ) {
                    aval = a[$scope.trackBy];
                    bval = b[$scope.trackBy];
                    if( aval === undefined || aval === null ) {
                        aval = "";
                    }
                    if( bval === undefined || bval === null ) {
                        bval = "";
                    }
                    if( aval > bval ) {
                        return descending ? -1 : 1;
                    }
                    else if( aval < bval ) {
                        return descending ? 1 : -1;
                    }
                }
                return 0;
            };

            $scope.pageLimitFun = function(array){
                if($attrs.tsDisplayPagination === "false"){
                    //pagination is disabled, so return everything
                    return array;
                }
                //Only return the items that are in the correct index range for the currently selected page
                var begin = ($scope.pagination.currentPage-1) * $scope.pagination.perPage;
                var end = ($scope.pagination.currentPage) * $scope.pagination.perPage;
                var final=[];
                for(var i=0; i < array.length; i++){
                    if(i >= begin && i < end){
                        final.push(array[i]);
                    }
                }
                return final;
            };

            if($attrs.tsDisplayFiltering !== "false" && $scope.filtering.template !== ""){
                var filterString = replaceTemplateTokens($scope, $scope.filtering.template);
                var $filter = $compile(filterString)($scope);
                //Add filtering HTML BEFORE the table - since jqLite has no `.before()` or `.insertBefore()` we have to do a little shuffling...
                $element.after($filter); //first we add the filter after the table
                $filter.after($element); //then we move the table after the filter, now the filter appears above the table!
            }

            if($attrs.tsDisplayPagination !== "false" && $scope.pagination.template !== ""){
                var pagerString = replaceTemplateTokens($scope, $scope.pagination.template)
                var $pager = $compile(pagerString)($scope);
                //Add pagination HTML AFTER the table
                $element.after($pager);
            }
        }
    };
}]);

tableSortModule.directive('tsCriteria', function() {
    return {
        require: "^tsWrapper",
        link: function(scope, element, attrs, tsWrapperCtrl) {
            var clickingCallback = function(event) {
                scope.$apply( function() {
                    if( event.shiftKey ) {
                        tsWrapperCtrl.addSortField(attrs.tsCriteria, element, attrs.tsName);
                    }
                    else {
                        tsWrapperCtrl.setSortField(attrs.tsCriteria, element, attrs.tsName);
                    }
                } );
            };
            element.bind('click', clickingCallback);
            element.addClass('tablesort-sortable');
            if( "tsDefault" in attrs && attrs.tsDefault !== "0" ) {
                tsWrapperCtrl.addSortField( attrs.tsCriteria, element, attrs.tsName );
                if( attrs.tsDefault == "descending" ) {
                    tsWrapperCtrl.addSortField( attrs.tsCriteria, element, attrs.tsName );
                }
            }
            if( "tsFilter" in attrs) {
                tsWrapperCtrl.addFilterField( attrs.tsCriteria, element, attrs.tsName );
            }
            tsWrapperCtrl.registerHeading( element );
        }
    };
});

tableSortModule.directive("tsRepeat", ['$compile', function($compile) {
    return {
        terminal: true,
        multiElement: true,
        require: "^tsWrapper",
        priority: 1000000,
        link: function(scope, element, attrs, tsWrapperCtrl) {
            var repeatAttrs = ["ng-repeat", "data-ng-repeat", "ng-repeat-start", "data-ng-repeat-start"];
            var ngRepeatDirective = repeatAttrs[0];
            var tsRepeatDirective = "ts-repeat";
            for (var i = 0; i < repeatAttrs.length; i++) {
                 if (angular.isDefined(element.attr(repeatAttrs[i]))) {
                    ngRepeatDirective = repeatAttrs[i];
                    tsRepeatDirective = ngRepeatDirective.replace(/^(data-)?ng/, '$1ts');
                    break;
                }
            }

            var repeatExpr = element.attr(ngRepeatDirective);
            var trackBy = null;
            var repeatExprRegex = /^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(\s+track\s+by\s+[\s\S]+?)?\s*$/;
            var trackByMatch = repeatExpr.match(/\s+track\s+by\s+\S+?\.(\S+)/);
            var repeatInMatch = repeatExpr.match(repeatExprRegex);
            if( trackByMatch ) {
                trackBy = trackByMatch[1];
                tsWrapperCtrl.setTrackBy(trackBy);
            }

            if (repeatExpr.search(/tablesort/) != -1) {
                repeatExpr = repeatExpr.replace(/tablesort/,"tablesortOrderBy:sortFun | tablesortFilterLimit:filterLimitFun | tablesortPageLimit:pageLimitFun");
            } else {
                repeatExpr = repeatExpr.replace(repeatExprRegex, "$1 in $2 | tablesortOrderBy:sortFun | tablesortFilterLimit:filterLimitFun | tablesortPageLimit:pageLimitFun$3");
            }
            
            if (angular.isUndefined(attrs.tsHideNoData)) {
                var noDataRow = angular.element(element[0]).clone();
                noDataRow.removeAttr(ngRepeatDirective);
                noDataRow.removeAttr(tsRepeatDirective);
                noDataRow.addClass("showIfLast");
                noDataRow.children().remove();
                noDataRow.append('<td colspan="' + element[0].childElementCount + '"></td>');
                noDataRow = $compile(noDataRow)(scope);
                element.parent().prepend(noDataRow);
            }
            
            //pass the `itemsList` from `item in itemsList` to the master directive
            tsWrapperCtrl.setDataForPager(repeatInMatch[2])

            angular.element(element[0]).attr(ngRepeatDirective, repeatExpr);
            $compile(element, null, 1000000)(scope);
        }
    };
}]);

tableSortModule.filter( 'tablesortPageLimit', function(){
    return function(array, pageLimitFun) {
       if(!array) return;
       return pageLimitFun(array);
    };
} );

tableSortModule.filter( 'tablesortFilterLimit', function(){
    return function(array, filterLimitFun) {
       if(!array) return;
        return filterLimitFun( array );
    };
} );

tableSortModule.filter( 'tablesortOrderBy', function(){
    return function(array, sortfun ) {
        if(!array) return;
        var arrayCopy = [];
        for ( var i = 0; i < array.length; i++) { arrayCopy.push(array[i]); }
        return arrayCopy.sort( sortfun );
    };
} );

tableSortModule.filter( 'parseInt', function(){
    return function(input) {
        return parseInt( input ) || null;
    };
} );

tableSortModule.filter( 'parseFloat', function(){
    return function(input) {
        return parseFloat( input ) || null;
    };
} );